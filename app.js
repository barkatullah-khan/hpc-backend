const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const hpcRoutes = require('./routes/hpcRoutes');
const authRoutes = require('./routes/authRoutes');
const AppError = require('./utils/AppError');
const globalErrorHandler = require('./controllers/ErrorController');

const app = express();

// ─── 1. GLOBAL MIDDLEWARES ─────────────────────────────────
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// ─── 2. ROUTES ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send("HPC API Gateway is Running...");
});

app.use('/api/hpc', hpcRoutes);
app.use('/api/auth', authRoutes);


app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// ─── 4. GLOBAL ERROR HANDLER ───────────────────────────────
app.use(globalErrorHandler);

module.exports = app;