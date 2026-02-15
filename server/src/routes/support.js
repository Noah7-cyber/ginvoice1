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

const summarizeUiContextForPrompt = (uiContext) => {
  if (!uiContext || typeof uiContext !== 'object') return '';

  const tab = typeof uiContext.tab === 'string' ? uiContext.tab : 'unknown';
  const parts = [`The user is currently on the ${tab} screen.`];

  if (tab === 'sales' && uiContext.cart && typeof uiContext.cart === 'object') {
    const itemCount = Number(uiContext.cart.itemCount || 0);
    const subtotal = Number(uiContext.cart.subtotal || 0);
    const items = Array.isArray(uiContext.cart.items) ? uiContext.cart.items.slice(0, 5) : [];
    const itemSummary = items.map(item => `${item?.name || 'Item'} x${Number(item?.quantity || 0)}`).join(', ');
    const customer = uiContext.cart.customerName ? ` for customer '${uiContext.cart.customerName}'` : '';
    parts.push(`Current cart has ${itemCount} item(s), subtotal ₦${subtotal.toLocaleString()}${customer}${itemSummary ? `, including: ${itemSummary}.` : '.'}`);
  }

  if (tab === 'inventory' && uiContext.inventory) {
    const { totalProducts, lowStockCount, totalValue } = uiContext.inventory;
    parts.push(`User is viewing their Stock List: ${totalProducts} total products, ${lowStockCount} items low on stock. Total inventory value is approx ₦${(totalValue || 0).toLocaleString()}.`);
  }

  if (tab === 'expenditure' && uiContext.expenditure) {
    const { totalCount, thisMonthTotal } = uiContext.expenditure;
    parts.push(`User is viewing their Expenses: ${totalCount} total records. This month's expenses sum to ₦${(thisMonthTotal || 0).toLocaleString()}.`);
  }

  if (tab === 'dashboard' && uiContext.dashboard) {
    const { totalRevenue, totalProfit, topProduct } = uiContext.dashboard;
    parts.push(`User is on the Dashboard. Key Stats: Revenue ₦${(totalRevenue || 0).toLocaleString()}, Profit ₦${(totalProfit || 0).toLocaleString()}. Top product: ${topProduct || 'N/A'}.`);
  }

  if (tab === 'settings' && uiContext.settings) {
    const { plan, businessName } = uiContext.settings;
    parts.push(`User is in Settings. Business Name: '${businessName}'. Current Plan: ${plan}.`);
  }

  if (tab === 'history' && uiContext.selectedInvoice && typeof uiContext.selectedInvoice === 'object') {
    const invoice = uiContext.selectedInvoice;
    parts.push(
      `Selected invoice: ID ${invoice.id || 'N/A'}, customer ${invoice.customerName || 'Unknown'}, total ₦${Number(invoice.totalAmount || 0).toLocaleString()}, paid ₦${Number(invoice.amountPaid || 0).toLocaleString()}, balance ₦${Number(invoice.balance || 0).toLocaleString()}, status ${invoice.paymentStatus || 'unknown'}.`
    );
  } else if (tab === 'history') {
    parts.push("User is viewing the list of Past Sales (Transaction History).");
  }

  return parts.join(' ');
};

const BOT_DAILY_LIMITS = {
  free: 15,
  trial: 40,
  paid: 500
};

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

const getBotTier = (business) => {
  const now = new Date();
  const subEnd = business?.subscriptionExpiresAt ? new Date(business.subscriptionExpiresAt) : null;
  const trialEnd = business?.trialEndsAt ? new Date(business.trialEndsAt) : null;

  const subscriptionActive = Boolean(subEnd && subEnd >= now);
  if (subscriptionActive) return 'paid';

  const trialActive = Boolean(trialEnd && trialEnd >= now);
  if (trialActive) return 'trial';

  return 'free';
};

const buildQuotaMessage = (tier, remaining) => {
  if (remaining > 0) return null;

  if (tier === 'paid') {
    return "You've reached your daily gBot limit (500/500). Please try again tomorrow.";
  }

  if (tier === 'trial') {
    return "You've used all 40 trial prompts for today. Upgrade to keep chatting up to 500 prompts/day.";
  }

  return "You've used all 15 free prompts for today. Start a trial or subscribe to continue with gBot.";
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
      .map((item) => item.riskScore != null
        ? `• ${item.name} (expected ${Number(item.expectedQty || 0)}, risk ${Number(item.riskScore || 0)}/100)`
        : `• ${item.name} (${Number(item.stock || item.currentStock || 0)} left)`);
    return `${result.message || 'Items found.'}\n${lines.join('\n')}`;
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

  // 1. Stock Check
  if (/low\s*stock|out\s*of\s*stock|stock\s*running\s*low/.test(text)) {
    const result = await executeTool({ name: 'check_low_stock', args: {} }, businessId, userRole);
    return {
      text: formatToolResult(result, 'Stock check complete.'),
      action: result?.special_action === 'NAVIGATE'
        ? { type: 'NAVIGATE', payload: result.screen, params: result.params }
        : null
    };
  }

  // 2. Debtors Check
  if (/debtor|owe|owing|unpaid|credit\s*sales?/.test(text)) {
    const result = await executeTool({ name: 'check_debtors', args: {} }, businessId, userRole);
    return {
      text: formatToolResult(result, 'Debtor check complete.'),
      action: result?.special_action === 'NAVIGATE'
        ? { type: 'NAVIGATE', payload: result.screen, params: result.params }
        : null
    };
  }

  // 3. Today's Summary (Fast Report)
  if (/today.*(sales?|revenue|profit)|(sales?|revenue|profit).*today/.test(text)) {
    const today = new Date().toISOString().slice(0, 10);
    const result = await executeTool({ name: 'get_business_report', args: { startDate: today, endDate: today } }, businessId, userRole);

    if (result && result.financials) {
        const { netBusinessProfit, netCashFlow } = result.financials;
        const revenue = Number(result.revenue?.sales || 0).toLocaleString();

        return {
            text: `Today's Summary:\n• Sales: ₦${revenue}\n• Business Profit: ₦${Number(netBusinessProfit || 0).toLocaleString()}\n• Cash Flow: ₦${Number(netCashFlow || 0).toLocaleString()}`,
            action: null
        };
    }
    return { text: "I could not generate today's summary right now.", action: null };
  }

  // 4. Navigation Help
  if (/(record|add|create|enter).*(sale|invoice|bill)/.test(text)) {
    return { text: "To record a sale: Open Sales tab, add items, and tap ‘Confirm Bill’.", action: { type: 'NAVIGATE', payload: 'sales' } };
  }

  return null;
};

// --- THE CHAT ROUTE ---
router.post('/chat', auth, async (req, res) => {
  try {
    const userMessage = typeof req.body.message === 'string' ? req.body.message.slice(0, MAX_MESSAGE_LENGTH) : '';
    const history = Array.isArray(req.body.history) ? req.body.history : [];
    const uiContext = req.body.uiContext && typeof req.body.uiContext === 'object' ? req.body.uiContext : null;
    const businessId = req.business?._id || req.businessId;
    const userRole = req.user?.role || 'staff';

    if (!businessId) {
       return res.json({ text: "I'm having trouble identifying your business account. Please try logging in again." });
    }


    const trimmedMessage = userMessage.trim();

    const businessDoc = await Business.findById(businessId).select('trialEndsAt subscriptionExpiresAt botUsage').lean();
    if (!businessDoc) {
      return res.status(404).json({ text: "Business not found." });
    }

    const tier = getBotTier(businessDoc);
    const todayKey = new Date().toISOString().slice(0, 10);
    const currentUsageDate = businessDoc.botUsage?.date || '';
    const currentUsageCount = currentUsageDate === todayKey ? Number(businessDoc.botUsage?.count || 0) : 0;
    const limit = BOT_DAILY_LIMITS[tier] || BOT_DAILY_LIMITS.free;

    if (trimmedMessage) {
      const remainingBefore = Math.max(0, limit - currentUsageCount);
      const quotaMessage = buildQuotaMessage(tier, remainingBefore);

      if (quotaMessage) {
        return res.status(429).json({
          text: quotaMessage,
          action: null,
          usage: { tier, used: currentUsageCount, limit, remaining: 0 }
        });
      }

      if (currentUsageDate === todayKey) {
        await Business.updateOne(
          { _id: businessId },
          { $inc: { 'botUsage.count': 1 } }
        );
      } else {
        await Business.updateOne(
          { _id: businessId },
          { $set: { 'botUsage.date': todayKey, 'botUsage.count': 1 } }
        );
      }
    }

    // A. Initialize System Prompt
    const contextSummary = summarizeUiContextForPrompt(uiContext);
    const todayISO = new Date().toISOString().split('T')[0];

    const systemPrompt = {
      role: "system",
      content: `You are gBot, an expert AI product architect and financial auditor inside the GInvoice app. Current Date: ${new Date().toDateString()} (ISO: ${todayISO}).
Do not act like a basic calculator. Your job is to provide deep financial insight and build trust through accuracy.

APP REALITY (STRICT): The user can only navigate these in-app tabs: sales, inventory, history, expenditure, dashboard, settings. Do NOT mention screens/buttons that do not exist.

NAVIGATION RULES: When giving instructions, reference visible labels in the current app UX like ‘Sales tab’, ‘Select Items’, right-side order panel, and ‘Confirm Bill’.

TOOL USAGE RULES (CRITICAL):
If asked about 'Performance', 'Profit', 'Revenue', or 'How much I made', you MUST use the get_business_report tool.
Do NOT use search_sales_records for financial summaries.
For 'Today's performance', call get_business_report with startDate: '${todayISO}' and endDate: '${todayISO}'.

CRITICAL: You CAN 'see' the user's screen through the CURRENT UI CONTEXT provided below. NEVER say 'I cannot see your screen', 'I don't have eyes', or 'Based on the app structure'. Speak confidently as if you are standing next to the user looking at the exact same screen.

FINANCIAL REPORTING STANDARDS:
1. Factor in 'Cash Inflow' (e.g., Grants, Loans) vs 'Cash Outflow' (Expenses) based on the provided cashFlow arrays.
2. Explicitly mention product categories in parentheses (e.g., 'Black (Shoes)').
3. You MUST clearly separate 'Personal' expenses from 'Business' expenses to show the user their true operational profit. Build user trust by showing your work.

CURRENT UI CONTEXT: ${contextSummary || 'No specific in-app context was provided for this message.'}
Use this UI context to answer directly when possible. If the question requires data outside this context, use available tools.

RESPONSE STYLE: short, practical, numbers-first, and owner-focused. If asked strategy, provide 2-4 actionable financial steps tied to their data.`
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


    // E. Critical API Key Check for full AI path
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error("CRITICAL: DEEPSEEK_API_KEY is missing.");
      return res.status(503).json({ text: "System Error: AI Service not configured.", action: null, usage: null });
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
                        },
                        usage: null
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
                action: null,
                usage: null
            });
        }

        // G. Standard Response (No Tool Calls)
        return res.json({ text: responseMessage.content, action: null, usage: null });

    } catch (error) {
        if (error.message === "Timeout") {
            return res.json({ text: "Market is busy right now. Please try again in a moment.", action: null, usage: null });
        }
        console.error('AI Execution Error:', error);
        return res.json({ text: "I'm having trouble connecting right now. Please try again.", action: null, usage: null });
    }

  } catch (error) {
    console.error('AI Route Error:', error);
    res.status(500).json({ text: "I'm having trouble connecting right now. Please try again.", action: null, usage: null });
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
