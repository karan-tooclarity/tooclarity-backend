const mongoose = require("mongoose");

const SchoolSchema = new mongoose.Schema({
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
  schoolName: { type: String },
  mode: { type: String, enum: ["Offline", "Online", "Hybrid"] },
  courseDuration: { type: String, trim: true, maxlength: 50 },
  startDate: { type: Date },
  classlanguage: { type: String },
  ownershipType: { type: String },
  schoolType: { type: String },
  curriculumType: { type: String },
  openingTime: { type: String },
  closingTime: { type: String },
  openingTimePeriod: { type: String, enum: ["AM", "PM"] },
  closingTimePeriod: { type: String, enum: ["AM", "PM"] },
  locationURL: { type: String, trim: true },
  headquatersAddress: { type: String },
  state: { type: String, trim: true, maxlength: 100 },
  district: { type: String, trim: true, maxlength: 100 },
  town: { type: String, trim: true, maxlength: 100 },
  classes: [
    { classType: { type: String }, priceOfCourse: { type: Number, min: 0 } },
  ],
  playground: { type: String, enum: ["Yes", "No"] },
  pickupDropService: { type: String, enum: ["Yes", "No"] },
  hostelFacility: { type: String, enum: ["Yes", "No"] },
  emioptions: { type: String, enum: ["Yes", "No"] },
  partlyPayment: { type: String, enum: ["Yes", "No"] },
  schoolPhotoUrl: { type: String },
  schoolImageUrl: { type: String },
  brochureUrl: { type: String },
});

const SchoolCourse = mongoose.model("SchoolCourse", SchoolSchema);
module.exports = SchoolCourse;
