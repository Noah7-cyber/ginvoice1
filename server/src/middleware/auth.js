const jwt = require('jsonwebtoken');
const Business = require('../models/Business');

const authMiddleware = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || '');
    req.businessId = payload.businessId;
    req.userRole = payload.role;

    // Fetch business to update lastActiveAt and get email for Admin check
    // We update lastActiveAt on every authenticated request to track usage accurately.
    const business = await Business.findByIdAndUpdate(
        payload.businessId,
        { lastActiveAt: new Date() },
        { new: true } // Return updated doc
    ).select('email credentialsVersion');

    if (!business) {
        // Token might be valid but business deleted
        return res.status(401).json({ message: 'Business not found' });
    }

    // Populate req.user for compatibility with new routes and Admin check
    req.user = {
      id: payload.userId || payload.id,
      businessId: payload.businessId,
      role: payload.role,
      email: business.email // Added: Needed for requireAdmin
    };

    // Force Logout Logic: Check credential version
    // Only check for non-owners (staff) as owners are the authority.
    if (payload.role !== 'owner') {
       // logic was checking business.credentialsVersion vs payload.credentialsVersion
       const currentVersion = business.credentialsVersion || 1;
       const tokenVersion = payload.credentialsVersion || 1;
       if (tokenVersion < currentVersion) {
          return res.status(401).json({ message: 'Session expired. Permissions updated. Please log in again.' });
       }
    }

    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const requireAdmin = (req, res, next) => {
    // Ensure authMiddleware has run
    if (!req.user || !req.user.email) {
        return res.status(403).json({ message: 'Forbidden: No user email found' });
    }

    // Check against ENV variable
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail || req.user.email !== adminEmail) {
        return res.status(403).json({ message: 'Forbidden: Access denied' });
    }

    next();
};

module.exports = authMiddleware;
module.exports.requireAdmin = requireAdmin;
