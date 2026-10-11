export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: 'Route not found.' } });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  const message = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'An unexpected server error occurred.'
    : error.message || 'An unexpected server error occurred.';
  if (status >= 500) console.error(error);
  res.status(status).json({ error: { message } });
}
