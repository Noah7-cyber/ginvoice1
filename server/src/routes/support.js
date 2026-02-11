const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const auth = require('../middleware/auth');
const { sendSupportEmail } = require('../services/mail');
const { tools, executeTool } = require('../services/aiTools');

// --- THE CHAT ROUTE ---
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

    // B. Initialize Model with SYSTEM INSTRUCTION
    // Persona: Nigerian business partner. Market OS. Benchmarks.
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash", // Updated model version
      systemInstruction: `You are the GInvoice Market OS Assistant. You speak like a savvy Nigerian business partner—witty, professional, and focused on growth.

Knowledge Context:
- Typical retail margins in Nigeria: 15-20%.
- Healthy inventory turnover: 4-6x per year.
- Use these benchmarks to analyze the user's data (e.g., "Your margin is 10%, which is below the 15% industry average").

Tools:
- Use 'get_business_data' for financial metrics (revenue, profit, expenses, inventory).
- Use 'MapsApp' to navigate the user to specific screens. IF YOU USE THIS TOOL, YOU MUST OUTPUT the JSON command returned by the tool in your final response to the user.

Current Date: ${new Date().toDateString()}`,
      tools: tools
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

    // E. Handle Tools
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];

      const businessId = req.business?._id || req.businessId;
      if (!businessId) {
            return res.json({ text: "I'm having trouble identifying your business account. Please try logging in again." });
      }

      // Execute the tool using the modular service
      const toolResult = await executeTool(call, businessId);

      // Feed result back to AI
      const result2 = await chat.sendMessage([{
        functionResponse: {
          name: call.name,
          response: toolResult
        }
      }]);
      return res.json({ text: result2.response.text() });
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
