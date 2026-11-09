const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User.model');
const Admin = require('../models/Admin.model');

/**
 * Service handling Google OAuth 2.0 / OpenID Connect authentication.
 * Enforces customer-only authorization and strict admin account isolation.
 */
class GoogleAuthService {
  /**
   * Instantiate Google OAuth2Client.
   * @returns {OAuth2Client} Configured OAuth2 client
   */
  static getClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL
      || 'http://localhost:5001/api/auth/google/callback';

    return new OAuth2Client(clientId, clientSecret, callbackUrl);
  }

  /**
   * Check if Google OAuth credentials have been configured.
   * @returns {boolean} True if real credentials exist
   */
  static isConfigured() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) return false;
    if (clientId.includes('placeholder') || clientSecret.includes('placeholder')) {
      return false;
    }
    return true;
  }

  /**
   * Generate authorization consent URL with state parameter.
   * @param {string} state - Base64 or random CSRF/redirect state string
   * @returns {string} Google authorization URL
   */
  static getAuthorizationUrl(state) {
    const client = this.getClient();
    return client.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      state,
      prompt: 'select_account',
    });
  }

  /**
   * Exchange OAuth authorization code for ID token payload.
   * @param {string} code - Google authorization code from callback
   * @returns {Promise<object>} Verified token payload
   */
  static async exchangeCodeForPayload(code) {
    const client = this.getClient();
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    return ticket.getPayload();
  }

  /**
   * Directly verify a Google ID token (e.g. from Google Identity Services).
   * @param {string} idToken - Google JWT ID token
   * @returns {Promise<object>} Verified token payload
   */
  static async verifyGoogleIdToken(idToken) {
    const client = this.getClient();
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    return ticket.getPayload();
  }

  /**
   * Process verified Google identity and resolve customer account.
   * Enforces account linking, verified email check, and admin account isolation.
   *
   * @param {object} payload - Verified Google identity payload
   * @returns {Promise<User>} Authenticated customer user document
   */
  static async processGoogleUser(payload) {
    const googleId = payload?.sub;
    const email = payload?.email;
    const name = payload?.name;
    const emailVerified = payload?.email_verified;

    if (!googleId || !email) {
      const err = new Error('Invalid Google account payload: missing user ID or email.');
      err.statusCode = 400;
      throw err;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Strict Admin Isolation:
    // Google authentication is customer-only. Never convert or link an Admin account.
    const existingAdmin = await Admin.findOne({ email: normalizedEmail });
    if (existingAdmin) {
      const err = new Error(
        'Administrative accounts cannot sign in using Google. Please use the admin login portal.',
      );
      err.statusCode = 403;
      err.code = 'ADMIN_ACCOUNT_OAUTH_PROHIBITED';
      throw err;
    }

    // 2. Google Verified Email Check:
    // Only trust Google identities where Google has verified the email address.
    if (!emailVerified) {
      const err = new Error(
        'A verified Google email address is required for authentication.',
      );
      err.statusCode = 400;
      err.code = 'GOOGLE_EMAIL_NOT_VERIFIED';
      throw err;
    }

    // 3. Returning Customer by Google ID:
    let user = await User.findOne({ googleId });
    if (user) {
      if (!user.isVerified) {
        user.isVerified = true;
        await user.save();
      }
      return user;
    }

    // 4. Safe Account Linking for Existing Password Customer:
    // If a customer registered with this email previously, link their Google ID.
    // Crucial: Existing passwordHash is NEVER overwritten or altered.
    user = await User.findOne({ email: normalizedEmail });
    if (user) {
      user.googleId = googleId;
      user.isVerified = true;
      await user.save();
      return user;
    }

    // 5. New Customer Account Creation:
    user = await User.create({
      name: (name || 'Customer').trim(),
      email: normalizedEmail,
      googleId,
      authProvider: 'google',
      role: 'customer',
      isVerified: true,
    });

    return user;
  }
}

module.exports = GoogleAuthService;
