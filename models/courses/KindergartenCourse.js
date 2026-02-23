const mongoose = require("mongoose");

const KindergartenSchema = new mongoose.Schema({
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

  categoriesType: {
    type: String,
    enum: ["Nursery", "LKG", "UKG", "Playgroup"],
  },

  courseName: { type: String, trim: true, maxlength: 150 },
  aboutCourse: { type: String, trim: true, maxlength: 3000 },
  courseDuration: { type: String, trim: true, maxlength: 50 },
  mode: { type: String, enum: ["Offline", "Online", "Hybrid"] },
  classSize: { type: String },
  priceOfCourse: { type: Number, min: 0 },
  ownershipType: {
    type: String,
    enum: ["Private", "Goverment", "Trust", "Other"],
  },
  locationURL: { type: String, trim: true },
  headquatersAddress: { type: String },
  state: { type: String, trim: true, maxlength: 100 },
  district: { type: String, trim: true, maxlength: 100 },
  town: { type: String, trim: true, maxlength: 100 },
  curriculumType: { type: String },
  openingTime: { type: String },
  closingTime: { type: String },
  openingTimePeriod: { type: String, enum: ["AM", "PM"] },
  closingTimePeriod: { type: String, enum: ["AM", "PM"] },
  operationalDays: [{ type: String }],
  extendedCare: { type: String, enum: ["Yes", "No"] },
  mealsProvided: { type: String, enum: ["Yes", "No"] },
  playground: { type: String, enum: ["Yes", "No"] },
  pickupDropService: { type: String, enum: ["Yes", "No"] },
  emioptions: { type: String, enum: ["Yes", "No"] },
  installments: { type: String, enum: ["Yes", "No"] },
  teacherStudentRatio: { type: String },
  centerImageUrl: { type: String },
  kindergartenImageUrl: { type: String },
  brochureUrl: { type: String },
});

const KinderCartenCourse = mongoose.model(
  "KindergartenCourse",
  KindergartenSchema,
);
module.exports = KinderCartenCourse;
