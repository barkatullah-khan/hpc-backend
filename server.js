const mongoose = require('mongoose');

require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 5000;


// -----mongoDB Connection-----
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1); // Exit if DB fails
  });

// -----Start Server-----
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}`);
});

process.on('unhandledRejection', (err) => {
  console.log('💥 UNHANDLED REJECTION! Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});