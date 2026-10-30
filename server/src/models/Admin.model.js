const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Admin Mongoose Schema
 * Privileged accounts seeded in the database.
 */
const adminSchema = new mongoose.Schema({
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
    required: true,
  },
  role: {
    type: String,
    enum: ['admin'],
    default: 'admin',
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
adminSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
