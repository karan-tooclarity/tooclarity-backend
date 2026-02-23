const mongoose = require("mongoose");

const ExamPrepScema = new mongoose.Schema({
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
  classlanguage: { type: String },
  classSize: { type: String },
  mockTests: { type: String, enum: ["Yes", "No"] },
  locationURL: { type: String, trim: true },
  headquatersAddress: { type: String },
  state: { type: String, trim: true, maxlength: 100 },
  district: { type: String, trim: true, maxlength: 100 },
  town: { type: String, trim: true, maxlength: 100 },
  priceOfCourse: { type: Number, min: 0 },
  centerImageUrl: { type: String },
  libraryFacility: { type: String, enum: ["Yes", "No"] },
  studyMaterial: { type: String, enum: ["Yes", "No"] },
  installments: { type: String, enum: ["Yes", "No"] },
  emioptions: { type: String, enum: ["Yes", "No"] },
  imageUrl: { type: String },
  brochureUrl: { type: String },
});

const ExamPrepCourse = mongoose.model("ExamPrepCourse", ExamPrepScema);
module.exports = ExamPrepCourse;
