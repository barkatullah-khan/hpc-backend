const AppError = require('../utils/AppError');
module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // This sends a nice JSON error back to your Frontend
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    university: "UET Mardan - HPC Portal"
  });
};