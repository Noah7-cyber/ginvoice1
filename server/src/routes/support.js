const express = require('express');
const router = express.Router();
const { sendSupportEmail } = require('../services/mail');
const auth = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { get_business_data } = require('../services/aiTools');

// Initialize Gemini
// Ensure GEMINI_API_KEY is in your .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Define the tool definition for Gemini
const businessDataTool = {
  functionDeclarations: [
    {
      name: "get_business_data",
      description: "Get financial and inventory data for the business. Use this to answer questions about revenue, profit, expenses, or stock counts.",
      parameters: {
        type: "OBJECT",
        properties: {
          metric: {
            type: "STRING",
            description: "The metric to retrieve. Options: 'revenue', 'profit', 'expenses', 'inventory_count'",
          },
          startDate: {
            type: "STRING",
            description: "Start date in YYYY-MM-DD format. Default to beginning of time if not specified.",
          },
          endDate: {
            type: "STRING",
            description: "End date in YYYY-MM-DD format. Default to today if not specified.",
          },
          groupBy: {
            type: "STRING",
            description: "Grouping for the data (e.g., 'day', 'month'). Optional.",
          },
        },
        required: ["metric"],
      },
    }
  ]
};

let model;
try {
  if (process.env.GEMINI_API_KEY) {
    model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      // 1. Move instructions here
      systemInstruction: `You are the GInvoice Assistant. You are helpful, friendly, and smart.
      You can answer specific business questions using your tools.
      If the user wants to perform an action, append a navigation tag to your response: [[NAVIGATE:screen_name]].
      Valid screens: sales, inventory, expenditure, dashboard, settings.
      Current Date: ${new Date().toISOString()}
      When using get_business_data, if the user doesn't specify a date range, ask for clarification OR assume "this month" or "all time" based on context, but explicitly state your assumption.`,
      tools: [
        businessDataTool,
        { googleSearch: {} } // Enable Google Search
      ],
    });
  }
} catch (err) {
  console.error("Failed to initialize Gemini model:", err);
}

router.post('/chat', auth, async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
       console.error("GEMINI_API_KEY not configured");
       return res.status(503).json({ text: "AI Assistant is not currently configured. Please try again later." });
    }

    if (!model) {
       return res.status(503).json({ text: "AI Service initialization failed. Please try again later." });
    }

    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    // Map frontend history to Gemini format
    // Filter out internal system messages or keep them if text is present
    let chatHistory = (history || []).map(msg => ({
      role: msg.from === 'bot' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));

    // CRITICAL FIX: Ensure history doesn't start with 'model'
    if (chatHistory.length > 0 && chatHistory[0].role === 'model') {
        chatHistory.shift();
    }

    // 2. Start with valid history
    const chat = model.startChat({
      history: chatHistory
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;

    // Check for function calls
    const calls = response.functionCalls();

    let text = "";

    if (calls && calls.length > 0) {
        // We only support one function for now
        const call = calls[0];
        if (call.name === 'get_business_data') {
            const args = call.args;
            try {
                // Execute the tool with req.business._id as requested
                // Note: get_business_data expects { businessId } in the second arg
                const toolResult = await get_business_data(args, { businessId: req.business._id });

                // Send the result back to the model
                const result2 = await chat.sendMessage([
                    {
                        functionResponse: {
                            name: 'get_business_data',
                            response: { result: toolResult }
                        }
                    }
                ]);

                text = result2.response.text();
            } catch (err) {
                console.error("Tool execution failed", err);
                text = "I'm sorry, I encountered an error while accessing your business data. Please try again later.";
            }
        } else {
             text = response.text();
        }
    } else {
        text = response.text();
    }

    res.json({ text });

  } catch (err) {
    console.error('AI Chat error', err);
    res.status(500).json({ message: 'AI service currently unavailable.' });
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
