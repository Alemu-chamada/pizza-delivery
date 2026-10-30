/**
 * Send a standardized success JSON response.
 * @param {object} res - Express response object
 * @param {object} [data={}] - Response payload
 * @param {number} [statusCode=200] - HTTP status code
 * @param {string} [message=''] - Optional success message
 */
const successResponse = (res, data = {}, statusCode = 200, message = '') => {
  const payload = { success: true };
  if (message) payload.message = message;
  if (data && Object.keys(data).length > 0) payload.data = data;
  return res.status(statusCode).json(payload);
};

/**
 * Send a standardized error JSON response.
 * @param {object} res - Express response object
 * @param {string} message - Error message
 * @param {number} [statusCode=400] - HTTP status code
 * @param {Array} [errors=[]] - Array of error details
 */
const errorResponse = (res, message, statusCode = 400, errors = []) => res.status(statusCode).json({
  success: false,
  message,
  errors,
});

module.exports = {
  successResponse,
  errorResponse,
};
