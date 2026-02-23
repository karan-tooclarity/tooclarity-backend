// routes/dashboard.routes.js
const express = require("express");
const { body ,param } = require("express-validator");
const dashboardController = require("../controllers/dashboard.controller");
const { otpLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// 🚀 Send OTP for password change
router.post(
  "/send-password-otp",
  otpLimiter,
  dashboardController.sendPasswordChangeOtp
);

// 🚀 Verify OTP for password change
router.post(
  "/verify-password-otp",
  [
    body("otp")
      .isString()
      .isLength({ min: 6, max: 6 })
      .withMessage("OTP must be 6 digits"),
  ],
  dashboardController.verifyPasswordChangeOtp
);

// ✅ NEW: Update password after successful OTP verification
router.post(
  "/update-password",
  [
    body("newPassword")
      .isString()
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long")
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .withMessage("Password must contain an uppercase letter, a lowercase letter, a number, and a special character."),
  ],
  dashboardController.updatePassword
);

// ✅ NEW: Get all courses and branches for the dashboard
router.get(
    "/get-entire-details",
    dashboardController.exportStructuredDataAsFile
);

// This route handles the dynamic payload from your settings page.
router.put(
    "/institutions/:institutionId",
    dashboardController.updateInstitutionAndCourseDetails // Point to the new controller function
);

module.exports = router;
