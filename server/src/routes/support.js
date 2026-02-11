const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const auth = require('../middleware/auth');
const { sendSupportEmail } = require('../services/mail');
const { tools, executeTool } = require('../services/aiTools');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- THE CHAT ROUTE ---
router.post('/chat', auth, async (req, res) => {
  try {
    // A. Critical API Key Check
    if (!process.env.GROQ_API_KEY) {
      console.error("CRITICAL: GROQ_API_KEY is missing in environment variables.");
      return res.status(503).json({ text: "System Error: AI Service not configured." });
    }

    const userMessage = req.body.message;
    const history = req.body.history || [];
    const businessId = req.business?._id || req.businessId;

    if (!businessId) {
       return res.json({ text: "I'm having trouble identifying your business account. Please try logging in again." });
    }

    // B. Initialize System Prompt
    const systemPrompt = {
      role: "system",
      content: `You are the GInvoice Market OS Assistant. You speak like a savvy Nigerian business partner—witty, professional, and focused on growth.

Knowledge Context:
- Typical retail margins in Nigeria: 15-20%.
- Healthy inventory turnover: 4-6x per year.
- Use these benchmarks to analyze the user's data (e.g., "Your margin is 10%, which is below the 15% industry average").

Tools:
- Use 'get_business_data' for financial metrics (revenue, profit, expenses, inventory).
- Use 'MapsApp' to navigate the user to specific screens. CRITICAL: You must ALSO provide a helpful sentence telling the user what to do on that screen (e.g., 'Taking you to Inventory so you can restock items.'). Never send the JSON command alone.

Current Date: ${new Date().toDateString()}`
    };

    // C. Construct Messages Array
    // Prevent context length errors by keeping only the last 10 turns
    const recentHistory = history.slice(-10);

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

    // D. Execution Loop with Retry
    const makeRequest = async (msgs, retryCount = 0) => {
        try {
            return await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: msgs,
                tools: tools,
                tool_choice: "auto"
            });
        } catch (error) {
            if (error.status === 429 && retryCount < 1) {
                console.warn("Rate limit hit, retrying in 2 seconds...");
                await new Promise(resolve => setTimeout(resolve, 2000));
                return makeRequest(msgs, retryCount + 1);
            }
            throw error;
        }
    };

    // First Call
    const completion = await makeRequest(messages);
    const responseMessage = completion.choices[0].message;

    // E. Handle Tool Calls
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
            const toolResult = await executeTool({ name: functionName, args: functionArgs }, businessId);

            // Append Tool Result
            messages.push({
                tool_call_id: toolCall.id,
                role: "tool",
                name: functionName,
                content: JSON.stringify(toolResult)
            });
        }

        // Second Call (Final Response)
        const finalCompletion = await makeRequest(messages);
        return res.json({ text: finalCompletion.choices[0].message.content });
    }

    // F. Standard Response (No Tool Calls)
    return res.json({ text: responseMessage.content });

  } catch (error) {
    if (error.status === 400 || error.status === 422) {
        console.warn('AI Context/Request Error (likely token limit):', error.status, error.message);
        return res.json({ text: "I'm having trouble remembering everything. Let's start a fresh topic!" });
    }
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
