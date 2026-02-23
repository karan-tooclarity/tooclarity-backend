const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Subscription = require("../models/Subscription");
const PLANS = require("../config/plans");

// GET /api/v1/institutions/:institutionId/subscriptions/history
// Returns all payment transactions for the institution
exports.getHistory = asyncHandler(async (req, res) => {
  const { institutionId } = req.params;

  if (!institutionId || !mongoose.Types.ObjectId.isValid(institutionId)) {
    return res.status(400).json({ success: false, message: "Invalid institutionId" });
  }

  // Get all subscription records for this institution
  // Only return records that have been paid (have razorpayPaymentId)
  // Sort by date descending (newest first)
  const subscriptions = await Subscription.find({
    institution: institutionId,
    razorpayPaymentId: { $exists: true, $ne: null },
  })
    .sort({ createdAt: -1 }) // Newest first
    .lean();

  if (!subscriptions || subscriptions.length === 0) {
    return res.status(200).json({ success: true, data: { items: [] } });
  }

  // Map all subscriptions to history items
  const items = subscriptions.map((sub) => ({
    _id: String(sub._id),
    subscriptionId: String(sub._id),
    invoiceId: sub.razorpayPaymentId || sub.razorpayOrderId || null,
    planType: sub.planType,
    status: sub.status,
    amount: sub.amount,
    date: sub.startDate || sub.createdAt,
    startDate: sub.startDate,
    endDate: sub.endDate,
    createdAt: sub.createdAt,
  }));

  return res.status(200).json({ success: true, data: { items } });
});


