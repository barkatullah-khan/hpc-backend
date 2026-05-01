const express        = require('express');
const cors           = require('cors');
const mongoose       = require('mongoose');
const cookieParser   = require('cookie-parser');
require('dotenv').config();

const hpcRoutes          = require('./routes/hpcRoutes');
const authRoutes         = require('./routes/authRoutes');
const AppError           = require('./utils/AppError');
const globalErrorHandler = require('./controllers/ErrorController');

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── 1. MIDDLEWARE ─────────────────────────────────────────
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// ─── 2. MONGODB CONNECTION ─────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err.message));

// ─── 3. ROUTES ─────────────────────────────────────────────
app.use('/api/hpc',  hpcRoutes);   // ✅ untouched
app.use('/api/auth', authRoutes);  // ✅ new

// ─── 4. HEALTH CHECK ───────────────────────────────────────
app.get('/', (req, res) => {
  res.send("HPC API Gateway is Running...");
});

// ─── 5. UNHANDLED ROUTES ───────────────────────────────────
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// ─── 6. GLOBAL ERROR HANDLER ───────────────────────────────
app.use(globalErrorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}`);
});