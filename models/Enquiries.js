const mongoose = require("mongoose");

const enquirySchema = new mongoose.Schema({
  institution: { type: mongoose.Schema.Types.ObjectId, ref: "Institution", required: true, index: true },

  programInterest: { type: String, trim: true },

  // Track specific course and its listing type (free vs paid)
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", index: true },
  listingType: {
    type: String,
    enum: ["paid", "free"],
    default: "paid"
  },
  enquiryType: {
    type: String,
    enum: ["Requested for callback", "Requested for demo"],
    required: true,
  },

  student: { type: mongoose.Schema.Types.ObjectId, ref: "InstituteAdmin", required: true },

  // Lead status for institution admin management (starts with enquiryType, then progresses)
  status: {
    type: String,
    enum: [
      // Initial enquiry types from students
      "Requested for callback",
      "Requested for demo",
      // Progressed statuses by institution admin
      "Contacted",
      "Interested",
      "Demo Scheduled",
      "Follow Up Required",
      "Qualified",
      "Not Interested",
      "Converted"
    ],
    required: true,
  },

  // Status change history for audit trail
  statusHistory: [{
    status: {
      type: String,
      enum: [
        // Initial enquiry types from students
        "Requested for callback",
        "Requested for demo",
        // Progressed statuses by institution admin
        "Contacted",
        "Interested",
        "Demo Scheduled",
        "Follow Up Required",
        "Qualified",
        "Not Interested",
        "Converted"
      ],
      required: true,
    },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "InstituteAdmin", required: true },
    changedAt: { type: Date, default: Date.now },
    notes: { type: String, trim: true }
  }],

}, { timestamps: true });

const Enquiries = mongoose.model("Enquiries", enquirySchema);
module.exports = Enquiries;
