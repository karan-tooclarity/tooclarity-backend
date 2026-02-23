const express = require('express');
const router = express.Router({ mergeParams: true });

const subscriptionController = require('../controllers/subscription.controller');

// History for an institution's subscription(s)
router.get('/history', subscriptionController.getHistory);

module.exports = router;


