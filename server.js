const express = require('express');
const cors = require('cors');
const hpcRoutes = require('./routes/hpcRoutes');
const AppError = require('./utils/AppError');
const globalErrorHandler = require('./controllers/ErrorController');

const app = express();
const PORT = 5000;

// 1. Middleware
app.use(cors());
app.use(express.json());

// 2. Main HPC Routes
app.use('/api/hpc', hpcRoutes);

// 3. Health Check
app.get('/', (req, res) => {
    res.send("HPC API Gateway is Running...");
});

app.all(/path/, (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// If that still gives a "PathError", use this version instead (it's the simplest):
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// 5. GLOBAL ERROR HANDLER (This MUST be the last middleware)
app.use(globalErrorHandler);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server ready at http://192.168.225.152:${PORT}`);
});