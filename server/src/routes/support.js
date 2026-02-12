const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { sendSupportEmail } = require('../services/mail');
const { client, MODEL_NAME, tools, executeTool, sanitizeData } = require('../services/aiTools');
const Business = require('../models/Business');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Expenditure = require('../models/Expenditure');
const Category = require('../models/Category');
const DiscountCode = require('../models/DiscountCode');
const Notification = require('../models/Notification');

const MAX_HISTORY_TURNS = 8;
const MAX_MESSAGE_LENGTH = 500;
const MAX_EXPORT_DOCS = 20000;

const normalizeText = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const normalizeCustomerKey = (value) => normalizeText(value).replace(/\s+/g, ' ');
const formatCustomerDisplayName = (value) => {
  const clean = normalizeCustomerKey(value);
  if (!clean) return 'Walk-in Customer';
  return clean
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatToolResult = (result, fallbackMessage) => {
  if (!result || typeof result !== 'object') return fallbackMessage;
  if (result.error) return result.error;

  if (Array.isArray(result.debtors) && result.debtors.length > 0) {
    const summary = new Map();
    result.debtors.forEach((tx) => {
      const key = normalizeCustomerKey(tx?.customerName);
      if (!key) return;
      const existing = summary.get(key) || { label: formatCustomerDisplayName(tx?.customerName), total: 0 };
      existing.total += Number(tx?.balance || 0);
      summary.set(key, existing);
    });

    const lines = Array.from(summary.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((item, index) => `${index + 1}. ${item.label} — ₦${item.total.toLocaleString()} outstanding`);

    if (lines.length > 0) {
      return `Found ${summary.size} debtor${summary.size > 1 ? 's' : ''}:\n${lines.join('\n')}`;
    }
  }

  if (Array.isArray(result.items) && result.items.length > 0) {
    const lines = result.items
      .slice(0, 5)
      .map((item) => `• ${item.name} (${Number(item.stock || item.currentStock || 0)} left)`);
    return `${result.message || 'Low stock items found.'}\n${lines.join('\n')}`;
  }

  if (result.message) return result.message;

  if (result.topSellingProduct?.name) {
    return `Top product: ${result.topSellingProduct.name} (${result.topSellingProduct.sold} sold).`;
  }

  return fallbackMessage;
};

const tryHandleCheapIntent = async (message, businessId, userRole) => {
  const text = normalizeText(message);
  if (!text) return null;

  if (/low\s*stock|out\s*of\s*stock|stock\s*running\s*low/.test(text)) {
    const result = await executeTool({ name: 'check_low_stock', args: {} }, businessId, userRole);
    return {
      text: formatToolResult(result, 'Stock check complete.'),
      action: result?.special_action === 'NAVIGATE'
        ? { type: 'NAVIGATE', payload: result.screen, params: result.params }
        : null
    };
  }

  if (/debtor|owe|owing|unpaid|credit\s*sales?/.test(text)) {
    const result = await executeTool({ name: 'check_debtors', args: {} }, businessId, userRole);
    return {
      text: formatToolResult(result, 'Debtor check complete.'),
      action: result?.special_action === 'NAVIGATE'
        ? { type: 'NAVIGATE', payload: result.screen, params: result.params }
        : null
    };
  }

  if (/last\s*sale|recent\s*sale|most\s*recent\s*transaction/.test(text)) {
    const result = await executeTool({ name: 'get_recent_transaction', args: {} }, businessId, userRole);
    if (result?.customerName || result?.totalAmount != null) {
      const customer = result.customerName || 'Walk-in customer';
      const total = Number(result.totalAmount || 0);
      return { text: `Latest sale was to ${customer} for ₦${total.toLocaleString()}.`, action: null };
    }
    return { text: formatToolResult(result, 'No recent sale found.'), action: null };
  }

  if (/(record|add|create|enter).*(sale|invoice|bill)|(sale|invoice|bill).*(record|add|create|enter)|how.*(sell|record)/.test(text)) {
    return {
      text: "To record a sale in this app:\n1) Open Sales tab.\n2) Tap any product under ‘Select Items’ to add it to cart.\n3) In the right Order panel, enter customer name/phone (optional).\n4) Choose payment method (Cash, Transfer, POS, or Debt).\n5) Confirm totals, then tap ‘Confirm Bill’.",
      action: {
        type: 'NAVIGATE',
        payload: 'sales'
      }
    };
  }

  if (/today.*(sales?|revenue|profit)|(sales?|revenue|profit).*today/.test(text)) {
    const today = new Date().toISOString().slice(0, 10);
    const result = await executeTool({ name: 'get_business_report', args: { startDate: today, endDate: today } }, businessId, userRole);
    if (result?.message && !result?.totalRevenue) {
      return { text: result.message, action: null };
    }
    if (result && typeof result === 'object') {
      const revenue = Number(result.totalRevenue || 0).toLocaleString();
      const expenses = Number(result.totalExpenses || 0).toLocaleString();
      const profit = Number(result.totalProfit || 0).toLocaleString();
      return {
        text: `Today's summary — Revenue: ₦${revenue}, Expenses: ₦${expenses}, Profit: ₦${profit}.`,
        action: null
      };
    }
    return { text: "I could not generate today's summary right now.", action: null };
  }


  if (/export|backup|download.*(data|transactions|records)|excel|csv/.test(text)) {
    return {
      text: "To export data, open Settings → Data, then tap Export Full Cloud Backup (JSON) or any CSV export button.",
      action: {
        type: 'NAVIGATE',
        payload: 'settings',
        params: { tab: 'data' }
      }
    };
  }

  return null;
};

// --- THE CHAT ROUTE ---
router.post('/chat', auth, async (req, res) => {
  try {
    const userMessage = typeof req.body.message === 'string' ? req.body.message.slice(0, MAX_MESSAGE_LENGTH) : '';
    const history = Array.isArray(req.body.history) ? req.body.history : [];
    const businessId = req.business?._id || req.businessId;
    const userRole = req.user?.role || 'staff';

    if (!businessId) {
       return res.json({ text: "I'm having trouble identifying your business account. Please try logging in again." });
    }

    // A. Initialize System Prompt
    const systemPrompt = {
      role: "system",
      content: `You are gBot, a concise Nigerian store manager + financial analyst inside the GInvoice app. Current Date: ${new Date().toDateString()}.\n\nAPP REALITY (STRICT): The user can only navigate these in-app tabs: sales, inventory, history, expenditure, dashboard, settings. Do NOT mention screens/buttons that do not exist (e.g., “New Invoice”, “Create Sale”, barcode scanner).\n\nNAVIGATION RULES: When giving instructions, reference visible labels in the current app UX like ‘Sales tab’, ‘Select Items’, right-side order panel, and ‘Confirm Bill’.\n\nRESPONSE STYLE: short, practical, numbers-first, and owner-focused. If asked strategy, provide 2-4 actionable financial steps tied to their data. If uncertain, ask one clarifying question instead of guessing.`
    };

    // B. Construct Messages Array
    // Prevent context length errors by keeping only the last 10 turns
    const recentHistory = history.slice(-MAX_HISTORY_TURNS);

    let messages = [systemPrompt];

    recentHistory.forEach(msg => {
        messages.push({
            role: msg.from === 'bot' ? 'assistant' : 'user',
            content: msg.text
        });
    });

    if (userMessage) {
        messages.push({ role: "user", content: userMessage });
    }

    // C. Fast path for predictable intents to reduce AI usage/cost.
    const cheapIntentResponse = await tryHandleCheapIntent(userMessage, businessId, userRole);
    if (cheapIntentResponse) {
      return res.json(cheapIntentResponse);
    }

    // E. Critical API Key Check for full AI path
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error("CRITICAL: DEEPSEEK_API_KEY is missing.");
      return res.status(503).json({ text: "System Error: AI Service not configured." });
    }

    // F. Execution Loop with Timeout
    const callAI = async (msgs) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        try {
            const completion = await client.chat.completions.create({
                model: MODEL_NAME,
                messages: msgs,
                tools: tools,
                tool_choice: "auto",
            }, { signal: controller.signal });

            clearTimeout(timeoutId);
            return completion;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error("Timeout");
            }
            throw error;
        }
    };

    try {
        // First Call
        const completion = await callAI(messages);
        const responseMessage = completion.choices[0].message;

        // F. Handle Tool Calls
        if (responseMessage.tool_calls) {
            // Append assistant's message with tool calls to history
            messages.push(responseMessage);

            for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name;
                let functionArgs;
                try {
                    functionArgs = JSON.parse(toolCall.function.arguments);
                } catch (e) {
                    console.error("Failed to parse tool arguments", e);
                    functionArgs = {};
                }

                // Execute Tool
                const toolResult = await executeTool({ name: functionName, args: functionArgs }, businessId, userRole);

                // SPECIAL INTERCEPTION: Large Data Sets / Direct Navigation
                if (toolResult && toolResult.special_action === 'NAVIGATE') {
                    // STOP immediately and return action to client
                    return res.json({
                        text: toolResult.message,
                        action: {
                            type: "NAVIGATE",
                            payload: toolResult.screen,
                            params: toolResult.params
                        }
                    });
                }

                // Append Tool Result
                messages.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: JSON.stringify(toolResult)
                });
            }

            // Second Call (Final Response)
            const finalCompletion = await callAI(messages);
            return res.json({
                text: finalCompletion.choices[0].message.content,
                action: null
            });
        }

        // G. Standard Response (No Tool Calls)
        return res.json({ text: responseMessage.content, action: null });

    } catch (error) {
        if (error.message === "Timeout") {
            return res.json({ text: "Market is busy right now. Please try again in a moment." });
        }
        console.error('AI Execution Error:', error);
        return res.json({ text: "I'm having trouble connecting right now. Please try again." });
    }

  } catch (error) {
    console.error('AI Route Error:', error);
    res.status(500).json({ text: "I'm having trouble connecting right now. Please try again." });
  }
});


const safeLimit = (scope) => scope === 'full' ? MAX_EXPORT_DOCS : 5000;

router.get('/export-data', auth, async (req, res) => {
  try {
    const businessId = req.business?._id || req.businessId;
    if (!businessId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const scope = req.query.scope === 'full' ? 'full' : 'lite';
    const limit = safeLimit(scope);
    const businessObjectId = typeof businessId === 'string' ? businessId : businessId.toString();

    const [business, products, transactions, expenditures, categories, discountCodes, notifications] = await Promise.all([
      Business.findById(businessObjectId).lean(),
      Product.find({ businessId: businessObjectId }).sort({ updatedAt: -1 }).limit(limit).lean(),
      Transaction.find({ businessId: businessObjectId }).sort({ transactionDate: -1 }).limit(limit).lean(),
      Expenditure.find({ business: businessObjectId }).sort({ date: -1 }).limit(limit).lean(),
      Category.find({ businessId: businessObjectId }).sort({ createdAt: -1 }).limit(limit).lean(),
      DiscountCode.find({ businessId: businessObjectId }).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.find({ businessId: businessObjectId }).sort({ timestamp: -1 }).limit(limit).lean()
    ]);

    const [txCount, productCount, expCount] = await Promise.all([
      Transaction.countDocuments({ businessId: businessObjectId }),
      Product.countDocuments({ businessId: businessObjectId }),
      Expenditure.countDocuments({ business: businessObjectId })
    ]);

    return res.json({
      exportedAt: new Date().toISOString(),
      scope,
      meta: {
        limitPerCollection: limit,
        truncated: txCount > limit || productCount > limit || expCount > limit,
        totals: {
          transactions: txCount,
          products: productCount,
          expenditures: expCount
        }
      },
      data: {
        business: sanitizeData(business),
        products: sanitizeData(products),
        transactions: sanitizeData(transactions),
        expenditures: sanitizeData(expenditures),
        categories: sanitizeData(categories),
        discountCodes: sanitizeData(discountCodes),
        notifications: sanitizeData(notifications)
      }
    });
  } catch (err) {
    console.error('Export data error', err);
    return res.status(500).json({ message: 'Failed to export data' });
  }
});

router.post('/contact', auth, async (req, res) => {
  try {
    const { message, email, businessName } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const html = `
      <h3>Support Request from ${businessName}</h3>
      <p><strong>User Email:</strong> ${email}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
      <hr />
      <p><small>Sent from Ginvoice App Support Bot</small></p>
    `;

    const result = await sendSupportEmail({
      to: process.env.SUPPORT_MAIL_USER, // Send TO the support inbox
      subject: `Help Request: ${businessName}`,
      html,
      text: `Support Request from ${businessName}\nUser Email: ${email}\nMessage: ${message}`
    });

    if (result.sent) {
      res.json({ success: true, message: 'Support request sent' });
    } else {
      res.status(500).json({ message: 'Failed to send email' });
    }
  } catch (err) {
    console.error('Support contact error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
