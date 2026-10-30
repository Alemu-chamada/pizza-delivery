const { errorResponse } = require('../utils/apiResponse');

/**
 * Role-based authorization middleware factory.
 * @param {string} role - Required role ('admin' or 'customer')
 * @returns {Function} Express middleware handler
 */
const requireRole = (role) => (req, res, next) => {
  if (!req.user || req.user.role !== role) {
    return errorResponse(res, `Forbidden. Requires ${role} role.`, 403);
  }
  return next();
};

const requireAdmin = requireRole('admin');
const requireCustomer = requireRole('customer');

module.exports = {
  requireRole,
  requireAdmin,
  requireCustomer,
};
