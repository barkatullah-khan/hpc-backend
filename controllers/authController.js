const jwt        = require('jsonwebtoken');
const User       = require('../models/User');
const AppError   = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// ─── REGISTER ─────────────────────────────────────────────
const register = catchAsync(async (req, res, next) => {
  const { username, password, role, name } = req.body;

  const existingUser = await User.findOne({ username });
  if (existingUser) return next(new AppError('User already exists', 400));

  const user = await User.create({ username, password, role, name });

  res.status(201).json({
    status: 'success',
    message: 'User created successfully',
    user: { id: user._id, username: user.username, role: user.role }
  });
});

// ─── LOGIN ─────────────────────────────────────────────────
const login = catchAsync(async (req, res, next) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user) return next(new AppError('Invalid username or password', 401));

  const isMatch = await user.comparePassword(password);
  if (!isMatch) return next(new AppError('Invalid username or password', 401));

  const token = jwt.sign(
    { userId: user._id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.status(200).json({
    status: 'success',
    message: 'Login successful',
    user: { name: user.name, role: user.role }
  });
});

// ─── LOGOUT ────────────────────────────────────────────────
const logout = (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ 
    status: 'success',
    message: 'Logged out successfully' 
  });
};

// ─── GET CURRENT USER ──────────────────────────────────────
const getMe = catchAsync(async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return next(new AppError('Not authenticated', 401));

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  res.status(200).json({ 
    status: 'success',
    user: decoded 
  });
});

module.exports = { register, login, logout, getMe };