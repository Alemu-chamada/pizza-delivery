/**
 * Wrap an async Express controller handler to catch unhandled rejections and forward to next().
 * @param {Function} fn - Async express route handler
 * @returns {Function} Express middleware handler
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
