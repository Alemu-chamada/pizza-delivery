const { verifyToken, clearTokenCookie } = require('../utils/jwt');
const { errorResponse } = require('../utils/apiResponse');
const User = require('../models/User.model');
const Admin = require('../models/Admin.model');

/**
 * Authentication middleware.
 * Verifies JWT from httpOnly cookie and attaches authenticated user/admin to req.user.
 */
const requireAuth = async (req, res, next) => {
  const token = req.cookies && req.cookies.token;

  if (!token) {
    return errorResponse(res, 'Authentication required. No token provided.', 401);
  }

  try {
    const decoded = verifyToken(token);

    let account;
    if (decoded.role === 'admin') {
      account = await Admin.findById(decoded.id).select('-passwordHash');
    } else {
      account = await User.findById(decoded.id).select(
        '-passwordHash -verificationToken -verificationTokenExpiry -resetToken -resetTokenExpiry',
      );
    }

    if (!account) {
      clearTokenCookie(res);
      return errorResponse(res, 'Account no longer exists.', 401);
    }

    req.user = account;
    return next();
  } catch (error) {
    clearTokenCookie(res);
    return errorResponse(res, 'Invalid or expired authentication token.', 401);
  }
};

module.exports = requireAuth;
