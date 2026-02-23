const express = require("express");
const { body } = require("express-validator");
const authController = require("../controllers/auth.controller");
const {
  validateRegistration,
  validateLogin,
} = require("../middleware/validators");
const { otpLimiter } = require("../middleware/rateLimiter");
// const { protect } = require('../middleware/globalAuth.middleware');
// const { protect } = require('../middleware/globalAuth.middleware');

const publicRouter = express.Router();
const protectedRouter = express.Router();

// const passwordResetLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 10,
//   message: 'Too many requests from this IP, please try again after 15 minutes',
//   standardHeaders: true,
//   legacyHeaders: false,
// });

publicRouter.post("/login", validateLogin, authController.login);

publicRouter.use(["/register", "/verify-otp", "/verify-email"], otpLimiter);

publicRouter.post("/register", validateRegistration, authController.register);

// 📱 Phone OTP verification
// router.post(
//     '/verify-otp',
//     body('contactNumber').isMobilePhone('any', { strictMode: true }),
//     body('otp').isString().isLength({ min: 6, max: 6 }).trim(),
//     authController.verifyPhoneOtp
// );

// 📧 Email OTP verification
publicRouter.post(
  "/verify-email",
  body("email"),
  // .isEmail().normalizeEmail(),
  body("otp").isString().isLength({ min: 6, max: 6 }).trim(),
  authController.verifyEmailOtp
);

protectedRouter.post("/logout", authController.logout);

publicRouter.post("/forgot-password", authController.forgotPassword);
publicRouter.patch("/reset-password/:token", authController.resetPassword);
publicRouter.post("/resend-otp", authController.resendOtp);
protectedRouter.put("/verify-contact-number", authController.updatePhoneNumber);

module.exports = { publicRouter, protectedRouter };
