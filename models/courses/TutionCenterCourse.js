const mongoose = require("mongoose");

const TutionCenterSchema = new mongoose.Schema({
  institution: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Institution",
    required: true,
    index: true,
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: false,
    index: true,
  },
  courseType: { type: String }, // Stores category like "Coaching centers", "Study Abroad", etc.
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Inactive",
  },
  courseSubscriptionStartDate: { type: Date },
  courseSubscriptionEndDate: { type: Date },

  listingType: {
    type: String,
    enum: ["free", "paid"],
    default: "free",
  },
  tutionCenterName: { type: String },
  mode: { type: String, enum: ["Offline", "Online", "Hybrid"] },
  operationalDays: [{ type: String }],
  openingTime: { type: String },
  closingTime: { type: String },
  openingTimePeriod: { type: String, enum: ["AM", "PM"] },
  closingTimePeriod: { type: String, enum: ["AM", "PM"] },
  subject: { type: String },
  classSize: { type: String },
  locationURL: { type: String, trim: true },
  headquatersAddress: { type: String },
  state: { type: String, trim: true, maxlength: 100 },
  district: { type: String, trim: true, maxlength: 100 },
  town: { type: String, trim: true, maxlength: 100 },
  subjectOffer: [
    {
      subject: { type: String },
      classTiming: { type: String },
      specialization: { type: String },
      fee: { type: Number },
    },
  ],
  faculty: [
    {
      facultyName: { type: String },
      experience: { type: Number },
      qualifications: { type: String },
      subjectYouTeach: { type: String },
    },
  ],
  partlyPayment: { type: String, enum: ["Yes", "No"] },
  campusImage: { type: String },
  imageUrl: { type: String },
  brochureUrl: { type: String },
});

const TutionCenterCourse = mongoose.model(
  "TutionCenterCourse",
  TutionCenterSchema,
);
module.exports = TutionCenterCourse;
