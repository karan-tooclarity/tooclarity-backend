const rateLimit = require('express-rate-limit');

// Stricter limiter for sending an OTP
exports.otpLimiter = rateLimit({
	windowMs: 5 * 60 * 1000,
	max: 5,
	standardHeaders: true,
	legacyHeaders: false,
    message: { status: 'fail', message: 'Too many OTP requests. Please try again later.' }
});