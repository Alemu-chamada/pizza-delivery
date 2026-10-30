const jwt = require('jsonwebtoken');
const { COOKIE_OPTIONS, JWT_EXPIRY } = require('../config/constants');

/**
 * Sign a JWT token with the provided payload.
 * @param {object} payload - Payload containing id and role
 * @returns {string} Signed JWT token
 */
const signToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET || 'default_jwt_secret_dev_only_change_in_production', {
  expiresIn: process.env.JWT_EXPIRY || JWT_EXPIRY,
});

/**
 * Verify a JWT token.
 * @param {string} token - JWT token string
 * @returns {object} Decoded payload
 */
const verifyToken = (token) => jwt.verify(
  token,
  process.env.JWT_SECRET || 'default_jwt_secret_dev_only_change_in_production',
);

/**
 * Send JWT in an httpOnly cookie.
 * @param {object} res - Express response object
 * @param {string} token - Signed JWT token
 */
const sendTokenCookie = (res, token) => {
  res.cookie('token', token, COOKIE_OPTIONS);
};

/**
 * Clear the authentication cookie.
 * @param {object} res - Express response object
 */
const clearTokenCookie = (res) => {
  res.cookie('token', '', {
    ...COOKIE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  });
};

module.exports = {
  signToken,
  verifyToken,
  sendTokenCookie,
  clearTokenCookie,
};
