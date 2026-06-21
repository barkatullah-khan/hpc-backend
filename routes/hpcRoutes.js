// routes/hpcRoutes.js
const express = require('express');
const router = express.Router();
const hpcController = require('../controllers/hpcController');

// 1. Basic Cluster Health Status Check
router.get('/master-status', hpcController.masterStatus);

// 2. Fetch Aggregated Performance Statistics
router.get('/stats', hpcController.getClusterStats);

// 3. Multi-Part File Boundary Parsing + Submit Controller 
router.post('/submit-job', hpcController.uploadMiddleware, hpcController.submitJob);

// 4. Live Queue Display Dashboard Tracking Data
router.get('/job-status', hpcController.getLiveQueue);

// 5. Open and Pipe Terminal Executed File Result Log File
router.get('/job-logs/:jobId', hpcController.getJobLogs);

module.exports = router;