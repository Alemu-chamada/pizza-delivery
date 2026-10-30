const crypto = require('crypto');

/**
 * Generate a cryptographically secure random token string.
 * @returns {string} Raw hex token string
 */
const generateRandomToken = () => crypto.randomBytes(32).toString('hex');

/**
 * Generate a cryptographically secure 6-digit verification code.
 * @returns {string} 6-digit numeric string
 */
const generateVerificationCode = () => crypto.randomInt(100000, 1000000).toString();

/**
 * Create a SHA-256 hash of a raw token string or verification code.
 * @param {string} rawToken - The raw token or code to hash
 * @returns {string} SHA-256 hex string
 */
const hashToken = (rawToken) => crypto.createHash('sha256').update(String(rawToken).trim()).digest('hex');

module.exports = {
  generateRandomToken,
  generateVerificationCode,
  hashToken,
};
