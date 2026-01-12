const nodemailer = require('nodemailer');

// Helper to create transport
const createTransport = (user, pass) => {
  if (!user || !pass) {
    return null;
  }

  // Specific fix for Zoho
  if (process.env.MAIL_HOST && process.env.MAIL_HOST.includes('zoho')) {
      const transporter = nodemailer.createTransport({
        host: "smtp.zoho.com",
        port: 465,
        secure: true, // MUST be true for port 465
        auth: {
            user,
            pass
        },
        logger: true,
        debug: true
      });
      // Verify connection
      transporter.verify().then(() => console.log(`Zoho Mail Connected for ${user}`)).catch(err => console.error(`Zoho Mail Error for ${user}:`, err));
      return transporter;
  }

  // Default behavior
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: Number(process.env.MAIL_PORT) === 465,
    auth: {
      user,
      pass
    }
  });
};

let systemTransport = null;
let supportTransport = null;

const getSystemTransport = () => {
  if (systemTransport) return systemTransport;
  systemTransport = createTransport(process.env.SYSTEM_MAIL_USER, process.env.SYSTEM_MAIL_PASS);
  return systemTransport;
};

const getSupportTransport = () => {
  if (supportTransport) return supportTransport;
  supportTransport = createTransport(process.env.SUPPORT_MAIL_USER, process.env.SUPPORT_MAIL_PASS);
  return supportTransport;
};

const sendSystemEmail = async ({ to, subject, html, text }) => {
  const transport = getSystemTransport();
  if (!transport) {
    console.warn('System Email skipped: Config missing');
    return { sent: false, reason: 'missing_config' };
  }

  try {
    await transport.sendMail({
      from: `"Ginvoice System" <${process.env.SYSTEM_MAIL_USER}>`,
      to,
      subject,
      text,
      html
    });
    return { sent: true };
  } catch (err) {
    console.error('System Email send failed', err);
    return { sent: false, reason: 'send_failed' };
  }
};

const sendSupportEmail = async ({ to, subject, html, text }) => {
  const transport = getSupportTransport();
  if (!transport) {
    console.warn('Support Email skipped: Config missing');
    return { sent: false, reason: 'missing_config' };
  }

  try {
    await transport.sendMail({
      from: `"Ginvoice Support" <${process.env.SUPPORT_MAIL_USER}>`,
      to,
      subject,
      text,
      html
    });
    return { sent: true };
  } catch (err) {
    console.error('Support Email send failed', err);
    return { sent: false, reason: 'send_failed' };
  }
};

module.exports = { sendSystemEmail, sendSupportEmail };
