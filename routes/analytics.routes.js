const express = require('express');
const analyticsController = require('../controllers/analytics.controller');
const router = express.Router();

// Changed from GET to POST because the endpoint reads from req.body
router.post('/institution', analyticsController.getInstitutionAnalytics);

module.exports = router;