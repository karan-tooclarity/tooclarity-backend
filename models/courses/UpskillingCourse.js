const mongoose = require("mongoose");

const UpskillingSchema = new mongoose.Schema({
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
  categoriesType: { type: String },
  domainType: { type: String },
  subDomainType: { type: String },
  courseName: { type: String, trim: true, maxlength: 150 },
  mode: { type: String, enum: ["Offline", "Online", "Hybrid"] },
  courseDuration: { type: String, trim: true, maxlength: 50 },
  startDate: { type: Date },
  classTiming: { type: String },
  courselanguage: { type: String },
  certification: { type: String, enum: ["Yes", "No"] },
  locationURL: { type: String, trim: true },
  headquatersAddress: { type: String },
  state: { type: String, trim: true, maxlength: 100 },
  district: { type: String, trim: true, maxlength: 100 },
  town: { type: String, trim: true, maxlength: 100 },
  placementDrives: { type: String, enum: ["Yes", "No"] },
  totalNumberRequires: { type: String },
  highestPackage: { type: String },
  averagePackage: { type: String },
  totalStudentsPlaced: { type: String },
  mockInterviews: { type: String, enum: ["Yes", "No"] },
  resumeBuilding: { type: String, enum: ["Yes", "No"] },
  linkedinOptimization: { type: String, enum: ["Yes", "No"] },
  priceOfCourse: { type: Number, min: 0 },
  centerImageUrl: { type: String },
  installments: { type: String, enum: ["Yes", "No"] },
  emioptions: { type: String, enum: ["Yes", "No"] },
  imageUrl: { type: String },
  brochureUrl: { type: String },
});

const UpskillingCourse = mongoose.model("UpskillingCourse", UpskillingSchema);
module.exports = UpskillingCourse;
