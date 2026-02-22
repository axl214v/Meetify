const config = require('../config/config');

// Middleware для обработки ошибок
const errorHandler = (err, req, res, next) => {
  var ErrLogger = new Map()
  console.error('Error:', {
    message: err.message,
    stack: config.environment.development ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Определяем код ошибки
  let statusCode = err.statusCode || err.status || 500;
  let errorMessage = err.message || 'Internal Server Error';

  // Специфические обработчики ошибок
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorMessage = 'Validation error';
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    errorMessage = 'Invalid ID format';
  }

  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 400;
    errorMessage = 'Duplicate entry';
  }

  // Отправляем ответ
  const errorResponse = {
    success: false,
    error: {
      message: errorMessage,
      statusCode: statusCode
    }
  };

  // Добавляем стек в development режиме
  if (config.environment.development) {
    errorResponse.error.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
  ErrLogger.set(statusCode, errorMessage)
};

// Middleware для обработки 404 ошибок
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Middleware для обработки ошибок в async функциях
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};
