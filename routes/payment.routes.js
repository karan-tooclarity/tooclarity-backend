const express = require('express');
const paymentController = require('../controllers/payment.controller');

const publicRouter = express.Router();
const protectedRouter = express.Router();

// 👇 Public webhook route
publicRouter.post('/verify', paymentController.verifyPayment);

// 👇 Protected routes
protectedRouter.post('/create-order', paymentController.createOrder);
protectedRouter.get('/verify-payment', paymentController.pollSubscriptionStatus);
protectedRouter.get('/details', paymentController.getPayableAmount);

module.exports = { publicRouter, protectedRouter };
