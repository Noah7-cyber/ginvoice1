const crypto = require('crypto');

/**
 * Hashes a string using SHA-256.
 * @param {string} value - The value to hash.
 * @returns {string|null} - The hashed value or null if input is empty.
 */
const hashValue = (value) => {
  if (!value) return null;
  // TikTok recommends lowercasing emails before hashing. Phone numbers might need normalization too.
  // For phone numbers, usually E.164 format is best, but we'll stick to hashing the raw input
  // after trimming and lowercasing for consistency unless specific formatting is required.
  const normalized = value.trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
};

/**
 * Sends a tracking event to TikTok.
 * @param {Object} data
 * @param {string} [data.email] - User's email.
 * @param {string} [data.phone] - User's phone.
 * @param {string} [data.ip] - User's IP address.
 * @param {string} [data.userAgent] - User's User Agent.
 * @param {string} [data.eventId] - Unique event ID.
 */
const sendTikTokEvent = async ({ email, phone, ip, userAgent, eventId }) => {
  try {
    const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
    const pixelId = process.env.TIKTOK_PIXEL_ID;

    if (!accessToken || !pixelId) {
      console.warn('TikTok tracking skipped: Missing TIKTOK_ACCESS_TOKEN or TIKTOK_PIXEL_ID');
      return;
    }

    const hashedEmail = hashValue(email);
    const hashedPhone = hashValue(phone);

    const payload = {
      pixel_code: pixelId,
      event: 'CompleteRegistration',
      event_id: eventId || crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      context: {
        user: {},
        ip: ip || undefined,
        user_agent: userAgent || undefined
      }
    };

    if (hashedEmail) payload.context.user.email = hashedEmail;
    if (hashedPhone) payload.context.user.phone_number = hashedPhone;

    // Using global fetch (Node 18+)
    const response = await fetch('https://business-api.tiktok.com/open_api/v1.3/pixel/track/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': accessToken
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`TikTok tracking failed: ${response.status} ${response.statusText}`, errorText);
    } else {
      // Optional: Log success if needed for debugging, but keeping it quiet for production
      // const result = await response.json();
      // console.log('TikTok tracking success:', result);
    }
  } catch (err) {
    // Fire and forget means we catch errors so they don't propagate
    console.error('TikTok tracking error:', err);
  }
};

module.exports = { sendTikTokEvent };
