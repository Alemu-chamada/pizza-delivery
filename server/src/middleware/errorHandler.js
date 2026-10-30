const { clearTokenCookie } = require('../utils/jwt');
const { errorResponse } = require('../utils/apiResponse');

/**
 * Centralized Express error-handling middleware.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || [];

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((val) => ({
      field: val.path,
      message: val.message,
    }));
  }

  // Mongoose CastError (invalid ObjectId, etc.)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
    errors = [{ field: err.path, message: `Invalid ${err.path}: ${err.value}` }];
  }

  // Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `An account with this ${field} already exists.`;
    errors = [{ field, message: `${field} is already in use` }];
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Invalid or expired authentication token.';
    clearTokenCookie(res);
  }

  // Log server errors in non-test environment
  if (statusCode === 500 && process.env.NODE_ENV !== 'test') {
    console.error('Unhandled server error:', err);
  }

  // Hide internal error details in production
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    message = 'Internal Server Error';
    errors = [];
  }

  return errorResponse(res, message, statusCode, errors);
};

module.exports = errorHandler;
