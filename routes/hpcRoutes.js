const express = require('express');
const router = express.Router();
const hpcController = require('../controllers/hpcController');

router.get('/status',hpcController.masterStatus);

router.get('/stats',hpcController.getClusterStats);
module.exports=router;