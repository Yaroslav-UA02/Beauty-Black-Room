/**
 * errorHandler.js — централізований обробник помилок Express
 * Використання в routes: next(err) замість res.status(500).json(...)
 */

// Обгортка для async route handlers — прибирає try/catch з кожного маршруту
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Middleware для помилок (4 аргументи — обов'язково)
const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} — ${status}: ${message}`);
  res.status(status).json({ error: message });
};

module.exports = { asyncHandler, errorHandler };
