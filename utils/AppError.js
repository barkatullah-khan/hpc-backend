class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // This means it's an expected error (like a wrong input)

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;