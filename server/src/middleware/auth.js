const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
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
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = authMiddleware;
