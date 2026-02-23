// Tracking transactions
// Decoupling business logic from payment gateway

const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    institutionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InstitutionAdmin', // Reference the user who made the purchase
        required: true,
    },
    planType: {
        type: String,
        enum: ["monthly", "yearly"],
        required: true,
    },
    baseAmount: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    finalAmount: { type: Number, required: true },
    couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon',
        default: null,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending',
    },
    paymentGatewayOrderId: { type: String, required: true, index: true },
    paymentId: { type: String }, // From payment gateway on success
    paymentSignature: { type: String }, // From payment gateway on success
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);