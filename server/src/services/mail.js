const nodemailer = require('nodemailer');

let cachedTransport = null;

const hasConfig = () => {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM);
};

const getTransport = () => {
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return cachedTransport;
};

const sendMail = async ({ to, subject, text, html }) => {
  if (!hasConfig()) {
    console.warn('Email skipped: SMTP env vars not configured');
    return { sent: false, reason: 'missing_config' };
  }

  try {
    const transport = getTransport();
    await transport.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      text,
      html
    });
    return { sent: true };
  } catch (err) {
    console.error('Email send failed', err);
    return { sent: false, reason: 'send_failed' };
  }
};

module.exports = { sendMail };
