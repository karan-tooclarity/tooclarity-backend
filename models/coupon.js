const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    discountPercentage: {
      type: Number,
      required: [true, "Discount percentage is required"],
      min: [1, "Discount must be at least 1%"],
      max: [100, "Discount cannot exceed 100%"],
    },
    institutions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Institution", // Assuming you have an Institution model
        required: true,
      },
    ],
    validTill: {
      type: Date,
      required: [true, "Valid till date is required"],
    },
    planType: {
      type: String,
      enum: ["monthly", "yearly"], // restrict only to supported plans
      required: [true, "Plan type is required"],
    },
    isActive: {
      type: Boolean,
      default: true, // helps for deactivating coupons without deleting
    },
    // --- Usage Tracking ---
    maxUses: {
      type: Number,
      default: 1,
      min: 1,
    },
    useCount: {
      type: Number,
      default: 0,
    },
    // --- Audit Trail ---
    redeemedBy: [{
      institutionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution' },
      redeemedAt: { type: Date, default: Date.now }
    }],
    // TODO: Admin id tracking
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, "Admin ID is required to create a coupon"]
    }
  },
  { timestamps: true }
);

// Compound index for performance on the apply/validate query
couponSchema.index({ code: 1, isActive: 1 });

module.exports = mongoose.model("Coupon", couponSchema);