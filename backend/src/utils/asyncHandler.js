/**
 * Wraps async route handlers to eliminate try-catch boilerplate.
 * Automatically forwards errors to Express error handler.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
