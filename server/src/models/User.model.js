const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Mongoose Schema
 * Represents customer accounts.
 */
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required() {
      // Password is required for accounts that are not authenticated via Google OAuth
      return !this.googleId;
    },
  },
  googleId: {
    type: String,
    sparse: true,
    index: true,
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local',
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: {
    type: String,
    default: null,
  },
  verificationTokenExpiry: {
    type: Date,
    default: null,
  },
  verificationCodeResendAfter: {
    type: Date,
    default: null,
  },
  resetToken: {
    type: String,
    default: null,
  },
  resetTokenExpiry: {
    type: Date,
    default: null,
  },
  role: {
    type: String,
    enum: ['customer'],
    default: 'customer',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * Compare entered password with stored password hash.
 * @param {string} candidatePassword - Plaintext candidate password
 * @returns {Promise<boolean>} True if match, false otherwise
 */
userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  if (!this.passwordHash) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
