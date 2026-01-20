const express = require('express');
const router = express.Router();
const { sendSupportEmail } = require('../services/mail');
const auth = require('../middleware/auth');

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
