const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

const protect = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return next(new AppError('Not authenticated', 401));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return next(new AppError('Invalid or expired token', 401));
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return next(new AppError('Admin access only', 403));
  }
  next();
};

module.exports = { protect, adminOnly };