const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Expenditure = require('../models/Expenditure');
const Product = require('../models/Product');
const { sendSupportEmail } = require('../services/mail');

// --- 1. DEFINE THE TOOLS (Calculator) ---
const businessTool = {
  name: "get_business_data",
  description: "Calculates specific business metrics (revenue, profit, expenses, inventory) for a given date range.",
  parameters: {
    type: "OBJECT",
    properties: {
      metric: {
        type: "STRING",
        description: "The metric to calculate.",
        enum: ["revenue", "profit", "expenses", "inventory_count"]
      },
      startDate: { type: "STRING", description: "Start date (YYYY-MM-DD)." },
      endDate: { type: "STRING", description: "End date (YYYY-MM-DD)." }
    },
    required: ["metric"]
  }
};

// --- 2. DEFINE THE TOOL EXECUTION LOGIC ---
async function executeBusinessTool(businessId, { metric, startDate, endDate }) {
  // Ensure we have a valid ID string
  const businessIdStr = businessId.toString();
  const businessIdObj = new mongoose.Types.ObjectId(businessIdStr);

  const start = startDate ? new Date(startDate) : new Date(0);
  const end = endDate ? new Date(endDate) : new Date();
  // Set end of day for end date
  if (endDate && endDate.length <= 10) {
      end.setHours(23, 59, 59, 999);
  }

  try {
    if (metric === 'revenue') {
      // Transaction uses businessId (ObjectId) and transactionDate
      const result = await Transaction.aggregate([
        {
            $match: {
                businessId: businessIdObj,
                transactionDate: { $gte: start, $lte: end }
            }
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]);
      return { revenue: result[0]?.total || 0, currency: "NGN" };
    }

    if (metric === 'expenses') {
      // Expenditure uses business (ObjectId) and date
      const result = await Expenditure.aggregate([
        {
            $match: {
                business: businessIdObj,
                date: { $gte: start, $lte: end },
                flowType: 'out' // Only count expenses
            }
        },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);
      return { expenses: parseFloat(result[0]?.total?.toString() || 0), currency: "NGN" };
    }

    if (metric === 'inventory_count') {
      // Product uses businessId (String)
      const count = await Product.countDocuments({ businessId: businessIdStr });
      return { total_products: count };
    }

    if (metric === 'profit') {
       // Simple estimation: Revenue - Expenses (for the selected period)
       // Revenue
       const revResult = await Transaction.aggregate([
        {
            $match: {
                businessId: businessIdObj,
                transactionDate: { $gte: start, $lte: end }
            }
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]);

      // Expenses
      const expResult = await Expenditure.aggregate([
        {
            $match: {
                business: businessIdObj,
                date: { $gte: start, $lte: end },
                flowType: 'out'
            }
        },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);

      const revenue = revResult[0]?.total || 0;
      const expenses = parseFloat(expResult[0]?.total?.toString() || 0);

      return {
          estimated_profit: revenue - expenses,
          revenue,
          expenses,
          currency: "NGN"
      };
    }

    return { error: "Metric not found" };
  } catch (err) {
    console.error("Tool Execution Error:", err);
    return { error: "Calculation failed" };
  }
}

// --- 3. THE CHAT ROUTE ---
router.post('/chat', auth, async (req, res) => {
  try {
    // A. Critical API Key Check
    if (!process.env.GEMINI_API_KEY) {
      console.error("CRITICAL: GEMINI_API_KEY is missing in environment variables.");
      return res.status(503).json({ text: "System Error: AI Service not configured." });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const userMessage = req.body.message;
    const history = req.body.history || [];

    // B. Initialize Model with SYSTEM INSTRUCTION (Correct Placement)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `You are the GInvoice Financial Assistant.
      - Help the user with business questions using your tools.
      - If they ask to navigate, append [[NAVIGATE:screen_name]] to your response.
      - Valid screens: sales, inventory, expenditure, dashboard, settings.
      - Current Date: ${new Date().toDateString()}`,
      tools: [ { functionDeclarations: [businessTool] } ]
    });

    // Clean history for Gemini (remove leading model messages)
    let chatHistory = history.map(msg => ({
      role: msg.from === 'bot' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));

    if (chatHistory.length > 0 && chatHistory[0].role === 'model') {
        chatHistory.shift();
    }

    // C. Start Chat with Correct History
    const chat = model.startChat({
      history: chatHistory
    });

    // D. Send Message
    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    const functionCalls = response.functionCalls();

    // E. Handle Calculator Tools
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      if (call.name === 'get_business_data') {
        // FIX: Use req.business._id instead of req.businessId
        // Also ensure req.business is available (auth middleware fixed earlier)
        const businessId = req.business?._id || req.businessId;

        if (!businessId) {
             return res.json({ text: "I'm having trouble identifying your business account. Please try logging in again." });
        }

        const toolData = await executeBusinessTool(businessId, call.args);

        // Feed result back to AI
        const result2 = await chat.sendMessage([{
          functionResponse: {
            name: 'get_business_data',
            response: toolData
          }
        }]);
        return res.json({ text: result2.response.text() });
      }
    }

    // F. Standard Response
    return res.json({ text: response.text() });

  } catch (error) {
    console.error('AI Route Error:', error);
    res.status(500).json({ text: "I'm having trouble connecting right now. Please try again." });
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
