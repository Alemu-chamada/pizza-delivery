const bcrypt = require('bcryptjs');
const User = require('../models/User.model');
const Admin = require('../models/Admin.model');
const EmailService = require('../services/email.service');
const {
  generateRandomToken,
  generateVerificationCode,
  hashToken,
} = require('../utils/generateToken');
const { signToken, sendTokenCookie, clearTokenCookie } = require('../utils/jwt');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const {
  BCRYPT_SALT_ROUNDS,
  VERIFICATION_CODE_EXPIRY_MINUTES,
  VERIFICATION_RESEND_COOLDOWN_SECONDS,
  RESET_TOKEN_EXPIRY_HOURS,
} = require('../config/constants');

/**
 * Customer Registration
 * POST /api/auth/register
 */
const register = async (req, res) => {
  const { name, email, password } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  // Check if account already exists
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return errorResponse(res, 'An account with this email already exists.', 409);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  // Generate 6-digit verification code (code sent in email, SHA-256 hash stored in DB)
  const rawCode = generateVerificationCode();
  const hashedVerificationCode = hashToken(rawCode);
  const verificationTokenExpiry = new Date(
    Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000,
  );
  const verificationCodeResendAfter = new Date(
    Date.now() + VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000,
  );

  // Create user with explicit customer role (never trust client role)
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role: 'customer',
    isVerified: false,
    verificationToken: hashedVerificationCode,
    verificationTokenExpiry,
    verificationCodeResendAfter,
  });

  // Attempt to send verification code email
  try {
    await EmailService.sendVerificationEmail(user.email, rawCode);
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Failed to send verification email:', err.message);
    }
  }

  return successResponse(
    res,
    {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
      previewCode: process.env.NODE_ENV !== 'production' ? rawCode : undefined,
    },
    201,
    'Registration successful. A 6-digit verification code has been sent to your email.',
  );
};

/**
 * Verify 6-Digit Email Verification Code
 * POST /api/auth/verify-code
 */
const verifyCode = async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return errorResponse(res, 'Email and 6-digit verification code are required.', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedCode = code.toString().trim();

  if (normalizedCode.length !== 6 || !/^\d{6}$/.test(normalizedCode)) {
    return errorResponse(res, 'Verification code must be exactly 6 digits.', 400);
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return errorResponse(res, 'Invalid or expired verification code.', 400);
  }

  if (user.isVerified) {
    return errorResponse(res, 'This account is already verified or the code has already been used.', 400);
  }

  if (!user.verificationToken || !user.verificationTokenExpiry) {
    return errorResponse(res, 'No active verification code found. Please request a new one.', 400);
  }

  if (user.verificationTokenExpiry < new Date()) {
    return errorResponse(res, 'Verification code has expired. Please request a new one.', 400);
  }

  const hashedCode = hashToken(normalizedCode);
  if (hashedCode !== user.verificationToken) {
    return errorResponse(res, 'Invalid verification code. Please check and try again.', 400);
  }

  // Activate user and clear code
  user.isVerified = true;
  user.verificationToken = null;
  user.verificationTokenExpiry = null;
  user.verificationCodeResendAfter = null;
  await user.save();

  return successResponse(
    res,
    { isVerified: true },
    200,
    'Email verified successfully. You can now log in.',
  );
};

/**
 * Resend Email Verification Code
 * POST /api/auth/resend-code
 */
const resendCode = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return errorResponse(res, 'Email is required.', 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  // Anti-enumeration: uniform response if user does not exist
  if (!user) {
    return successResponse(
      res,
      {},
      200,
      'If an unverified account with that email exists, a new verification code has been sent.',
    );
  }

  if (user.isVerified) {
    return successResponse(
      res,
      { isVerified: true },
      200,
      'Account is already verified. You can log in directly.',
    );
  }

  // Rate limiting / cooldown check (60 seconds)
  if (user.verificationCodeResendAfter && user.verificationCodeResendAfter > new Date()) {
    const diffMs = user.verificationCodeResendAfter - Date.now();
    const remainingSeconds = Math.max(1, Math.ceil(diffMs / 1000));
    return res.status(429).json({
      success: false,
      message: `Please wait ${remainingSeconds} seconds before requesting another code.`,
      remainingSeconds,
    });
  }

  // Generate new code — invalidates prior code
  const rawCode = generateVerificationCode();
  const hashedCode = hashToken(rawCode);
  const verificationTokenExpiry = new Date(
    Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000,
  );
  const verificationCodeResendAfter = new Date(
    Date.now() + VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000,
  );

  user.verificationToken = hashedCode;
  user.verificationTokenExpiry = verificationTokenExpiry;
  user.verificationCodeResendAfter = verificationCodeResendAfter;
  await user.save();

  try {
    await EmailService.sendVerificationCodeEmail(user.email, rawCode);
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Failed to resend verification email:', err.message);
    }
  }

  return successResponse(
    res,
    {
      cooldownSeconds: VERIFICATION_RESEND_COOLDOWN_SECONDS,
      previewCode: process.env.NODE_ENV !== 'production' ? rawCode : undefined,
    },
    200,
    'A new verification code has been sent to your email.',
  );
};

/**
 * Verify Email Address (token / code compatibility)
 * GET /api/auth/verify-email?token=<token>
 */
const verifyEmail = async (req, res) => {
  const { token, code, email } = req.query;

  if (code && email) {
    req.body = { email, code };
    return verifyCode(req, res);
  }

  if (!token) {
    return errorResponse(res, 'Verification token is required.', 400);
  }

  const hashedToken = hashToken(token);

  const user = await User.findOne({
    verificationToken: hashedToken,
    verificationTokenExpiry: { $gt: new Date() },
  });

  if (!user) {
    return errorResponse(res, 'Invalid or expired verification token.', 400);
  }

  user.isVerified = true;
  user.verificationToken = null;
  user.verificationTokenExpiry = null;
  user.verificationCodeResendAfter = null;
  await user.save();

  return successResponse(
    res,
    { isVerified: true },
    200,
    'Email verified successfully. You can now log in.',
  );
};

/**
 * Customer & Admin Unified Login
 * POST /api/auth/login
 */
const login = async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Check Customer account
  const user = await User.findOne({ email: normalizedEmail });
  if (user) {
    const isPasswordValid = await user.comparePassword(password);
    if (isPasswordValid) {
      if (!user.isVerified) {
        return errorResponse(res, 'Please verify your email before logging in.', 403);
      }

      // Issue signed JWT in httpOnly cookie
      const token = signToken({ id: user._id, role: user.role });
      sendTokenCookie(res, token);

      return successResponse(
        res,
        {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        },
        200,
        'Login successful.',
      );
    }
  }

  // 2. Check Admin account (allows admin to log in seamlessly via /login)
  const admin = await Admin.findOne({ email: normalizedEmail });
  if (admin) {
    const isPasswordValid = await admin.comparePassword(password);
    if (isPasswordValid) {
      // Issue signed JWT in httpOnly cookie with role=admin
      const token = signToken({ id: admin._id, role: admin.role });
      sendTokenCookie(res, token);

      return successResponse(
        res,
        {
          user: {
            id: admin._id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
          },
          admin: {
            id: admin._id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
          },
        },
        200,
        'Admin login successful.',
      );
    }
  }

  // 3. Neither matched or password was incorrect
  return errorResponse(res, 'Invalid email or password.', 401);
};

/**
 * Admin Login
 * POST /api/auth/admin-login
 */
const adminLogin = async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  const admin = await Admin.findOne({ email: normalizedEmail });
  if (!admin) {
    return errorResponse(res, 'Invalid admin credentials.', 401);
  }

  const isPasswordValid = await admin.comparePassword(password);
  if (!isPasswordValid) {
    return errorResponse(res, 'Invalid admin credentials.', 401);
  }

  // Issue signed JWT in httpOnly cookie with role=admin
  const token = signToken({ id: admin._id, role: admin.role });
  sendTokenCookie(res, token);

  return successResponse(
    res,
    {
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    },
    200,
    'Admin login successful.',
  );
};

/**
 * Customer Logout
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  clearTokenCookie(res);
  return successResponse(res, {}, 200, 'Logged out successfully.');
};

/**
 * Admin Logout
 * POST /api/auth/admin-logout
 */
const adminLogout = async (req, res) => {
  clearTokenCookie(res);
  return successResponse(res, {}, 200, 'Admin logged out successfully.');
};

/**
 * Forgot Password
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail });

  // Security requirement: Always return 200 to prevent user enumeration
  if (user) {
    const rawResetToken = generateRandomToken();
    const hashedResetToken = hashToken(rawResetToken);
    const resetTokenExpiry = new Date(
      Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    user.resetToken = hashedResetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    try {
      await EmailService.sendPasswordResetEmail(user.email, rawResetToken);
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Failed to send password reset email:', err.message);
      }
    }
  }

  return successResponse(
    res,
    {},
    200,
    'If an account with that email exists, a password reset link has been sent.',
  );
};

/**
 * Reset Password
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
  const { token, password } = req.body;

  if (!token) {
    return errorResponse(res, 'Reset token is required.', 400);
  }

  const hashedToken = hashToken(token);

  const user = await User.findOne({
    resetToken: hashedToken,
    resetTokenExpiry: { $gt: new Date() },
  });

  if (!user) {
    return errorResponse(res, 'Invalid or expired password reset token.', 400);
  }

  // Hash new password and invalidate token
  const newPasswordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  user.passwordHash = newPasswordHash;
  user.resetToken = null;
  user.resetTokenExpiry = null;
  await user.save();

  return successResponse(
    res,
    {},
    200,
    'Password has been reset successfully. You can now log in.',
  );
};

/**
 * Current User Profile / Session
 * GET /api/auth/me
 */
const getMe = async (req, res) => successResponse(res, {
  user: {
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    isVerified: req.user.isVerified,
  },
});

module.exports = {
  register,
  verifyEmail,
  verifyCode,
  resendCode,
  login,
  adminLogin,
  logout,
  adminLogout,
  forgotPassword,
  resetPassword,
  getMe,
};
