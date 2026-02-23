const express = require("express");
const publicController = require("../controllers/public.controller");

const router = express.Router();

/**
 * @route   GET /api/v1/public/courses
 * @desc    Get all visible courses (from institutions with active subscriptions)
 * @access  Public (No authentication required)
 */
router.get("/courses", publicController.getAllVisibleCourses);

module.exports = router;