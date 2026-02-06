const jwt = require('jsonwebtoken');

const adminAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || '');

    // Strict check for superadmin role
    if (payload.role !== 'superadmin') {
         return res.status(403).json({ message: 'Forbidden: Insufficient privileges' });
    }

    req.admin = {
        email: process.env.ADMIN_EMAIL
    };

    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

module.exports = adminAuth;
