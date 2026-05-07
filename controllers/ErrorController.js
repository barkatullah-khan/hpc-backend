const AppError = require('../utils/AppError');

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // CRITICAL: Log the error so you can see the stack trace in your terminal!
  console.error('ERROR 💥:', err);

  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    // Add this line temporarily to see exactly where the code is breaking
    stack: err.stack, 
    university: "UET Mardan - HPC Portal"
  });
};