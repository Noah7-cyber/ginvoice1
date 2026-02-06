// server/src/services/emailTemplates.js

const PRIMARY_COLOR = '#4f46e5';
const FOOTER_TEXT = 'Ginvoice Market OS • Made for Nigerian Traders 🇳🇬';

const baseTemplate = (content, title = 'Ginvoice Notification') => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background-color: ${PRIMARY_COLOR}; padding: 20px; text-align: center; color: #ffffff; }
    .logo-placeholder { font-size: 24px; font-weight: bold; letter-spacing: 1px; }
    .content { padding: 30px 20px; color: #374151; line-height: 1.6; }
    .button { display: inline-block; background-color: ${PRIMARY_COLOR}; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 20px; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo-placeholder">GINVOICE</div>
      </div>
      <div class="content">
        ${content}
      </div>
    </div>
    <div class="footer">
      ${FOOTER_TEXT}
    </div>
  </div>
</body>
</html>
`;

const buildWelcomeEmail = ({ businessName }) => {
  const content = `
    <h2 style="margin-top: 0; color: #111827;">Welcome to Ginvoice! 🚀</h2>
    <p>Hello <strong>${businessName}</strong>,</p>
    <p>We are thrilled to have you on board. Ginvoice is built to help Nigerian traders manage their business with ease.</p>
    <p>Your store has been successfully registered and is ready to use.</p>
    <p>Get started by adding your first product!</p>
    <div style="text-align: center; margin-top: 30px;">
      <a href="${process.env.FRONTEND_URL || '#'}" class="button" style="color: #ffffff;">Go to Dashboard</a>
    </div>
  `;
  return baseTemplate(content, 'Welcome to Ginvoice');
};

const buildRecoveryEmail = ({ code }) => {
  const content = `
    <h2 style="margin-top: 0; color: #111827;">Reset Your PIN</h2>
    <p>You requested to reset your Ginvoice owner PIN.</p>
    <p>Use the code below to complete the process. This code is valid for <strong>15 minutes</strong>.</p>
    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: ${PRIMARY_COLOR};">${code}</span>
    </div>
    <p style="font-size: 14px; color: #6b7280;">If you did not request this change, please ignore this email.</p>
  `;
  return baseTemplate(content, 'Reset Your PIN');
};

const buildVerificationEmail = ({ verificationUrl, businessName, code }) => {
  const content = `
    <h2 style="margin-top: 0; color: #111827;">Verify Your Email</h2>
    <p>Hello <strong>${businessName}</strong>,</p>
    <p>Please verify your email address to secure your account and unlock full features.</p>

    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #6b7280; font-weight: bold;">Your Verification Code</p>
      <span style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: ${PRIMARY_COLOR}; display: block;">${code}</span>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #ef4444;">(Expires in 30 minutes)</p>
    </div>

    <div style="text-align: center; margin-top: 20px;">
      <p style="font-size: 14px; margin-bottom: 10px;">Or click the button below:</p>
      <a href="${verificationUrl}" class="button" style="color: #ffffff;">Verify Email Address</a>
    </div>
  `;
  return baseTemplate(content, 'Verify Your Email');
};

module.exports = {
  buildWelcomeEmail,
  buildRecoveryEmail,
  buildVerificationEmail
};
