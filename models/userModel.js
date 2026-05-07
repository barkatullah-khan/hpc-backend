const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs'); // Don't forget to require this!

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please tell us your name!']
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email']
  },
  photo: {
    type: String,
    default: 'default.jpg'
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
    select: false // Set to false to hide passwords in API responses
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      validator: function (el) {
        return el === this.password;
      },
      message: 'Passwords are not the same!'
    }
  },
  passwordChangedAt: Date,
  active: {
    type: Boolean,
    default: true,
    select: false
  }
}, {
  autoIndex: false // Helps stop that "ghost index" username error from reappearing
});

// --- MIDDLEWARE (HOOKS) ---

// 1. Password Hashing (The Safe Way)
userSchema.pre('save', async function () {
  // Only run if password was modified
  if (!this.isModified('password')) return;

  // Hash password
  this.password = await bcrypt.hash(this.password, 12);

  // Delete passwordConfirm
  this.passwordConfirm = undefined;
});

// 2. Query Middleware (Filter out inactive users)
userSchema.pre(/^find/, function () {
  this.find({ active: { $ne: false } });
});

// --- INSTANCE METHODS ---

userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

const User = mongoose.model('User', userSchema);

module.exports = User;