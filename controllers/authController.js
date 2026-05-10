const jwt        = require('jsonwebtoken');
const User       = require('../models/userModel');
const AppError   = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// ─── REGISTER ─────────────────────────────────────────────
const register = catchAsync(async (req, res, next) => {
  const { name, email, password, passwordConfirm, role } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) return next(new AppError('User already exists', 400));

  const user = await User.create({
  name,
  email,
  password,
  passwordConfirm,
  role:req.body.role
  // Don't pass role here; let the model use the default!
});

  res.status(201).json({
    status: 'success',
    message: 'User created successfully',
    user: { id: user._id, email: user.email, role: user.role }
  });
});

// ─── LOGIN ─────────────────────────────────────────────────
const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // email and password exist?
  if (!email || !password) return next(new AppError('Please provide email and password', 400));

  // find user + include password
  const user = await User.findOne({ email }).select('+password');
  if (!user) return next(new AppError('Invalid email or password', 401));

  // check password
  const isMatch = await user.correctPassword(password, user.password);
  if (!isMatch) return next(new AppError('Invalid email or password', 401));

  const token = jwt.sign(
    { userId: user._id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
  });

  res.status(200).json({
    status: 'success',
    message: 'Login successful',
    user: { name: user.name, role: user.role }
  });
});

// ─── LOGOUT ────────────────────────────────────────────────
const logout = (req, res) => {
  // Pass the same options used during login (except maxAge/expires)
  res.clearCookie('token', {
    httpOnly: true,
    secure: false, // matches your login setting
    sameSite: 'lax'
  });

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