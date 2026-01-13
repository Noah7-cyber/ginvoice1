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
    // Populate req.user for compatibility with new routes
    req.user = {
      id: payload.userId || payload.id, // Assuming payload has userId or id
      businessId: payload.businessId,
      role: payload.role
    };

    // Force Logout Logic: Check credential version
    // Optimization: We could cache this, but for strictness we check DB.
    // Only check for non-owners (staff) as owners are the authority.
    if (payload.role !== 'owner') {
       const freshBusiness = await Business.findById(payload.businessId).select('credentialsVersion').lean();
       if (freshBusiness) {
          const currentVersion = freshBusiness.credentialsVersion || 1;
          const tokenVersion = payload.credentialsVersion || 1;
          if (tokenVersion < currentVersion) {
             return res.status(401).json({ message: 'Session expired. Permissions updated. Please log in again.' });
          }
       }
    }

    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = authMiddleware;
