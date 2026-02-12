const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { sendSupportEmail } = require('../services/mail');
const { client, MODEL_NAME, tools, executeTool } = require('../services/aiTools');

// --- THE CHAT ROUTE ---
router.post('/chat', auth, async (req, res) => {
  try {
    // A. Critical API Key Check
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error("CRITICAL: DEEPSEEK_API_KEY is missing.");
      return res.status(503).json({ text: "System Error: AI Service not configured." });
    }

    const userMessage = req.body.message;
    const history = req.body.history || [];
    const businessId = req.business?._id || req.businessId;
    const userRole = req.user?.role || 'staff';

    if (!businessId) {
       return res.json({ text: "I'm having trouble identifying your business account. Please try logging in again." });
    }

    // B. Initialize System Prompt
    const systemPrompt = {
      role: "system",
      content: `You are a witty, professional Nigerian store manager for GInvoice. Current Date: ${new Date().toDateString()}. You analyze data and help navigate the app. Keep answers short.`
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

    // D. Execution Loop with Timeout
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

        // F. Standard Response (No Tool Calls)
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
