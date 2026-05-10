const express = require('express');
const router = express.Router();
const hpcController = require('../controllers/hpcController');

router.get('/master-status',hpcController.masterStatus);

router.get('/stats',hpcController.getClusterStats);

router.post('/submit-job', hpcController.submitJob);

router.get('/job-status', hpcController.getLiveQueue);

router.get('/job-logs/:jobId', hpcController.getJobLogs);

module.exports=router;