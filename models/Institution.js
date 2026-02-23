const mongoose = require("mongoose");

const institutionSchema = new mongoose.Schema(
  {
    instituteName: {
      type: String,
      required: [true, "Institution name is required."],
      trim: true,
    },
    instituteType: {
      type: String,
      required: [true, "Institution type is required."],
      enum: [
        "Kindergarten/childcare center",
        "School's",
        "Intermediate college(K12)",
        "Under Graduation/Post Graduation",
        "Exam Preparation",
        "Upskilling",
        "Tution Center's",
        "Study Abroad",
      ],
      index: true,
    },
    establishmentDate: {
      type: String,
      trim: true,
    },
    approvedBy: {
      type: String,
      trim: true,
    },
    contactInfo: {
      type: String,
      trim: true,
    },
    additionalContactInfo: {
      type: String,
      trim: true,
    },
    headquartersAddress: {
      type: String,
      required: [true, "Headquarter address is required."],
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
      index: true,
    },
    locationURL: {
      type: String,
      trim: true,
    },
    logoUrl: {
      type: String,
      default: "",
    },
    institutionAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InstituteAdmin",
      required: true,
      index: true,
    },
  }
);

const Institution = mongoose.model("Institution", institutionSchema);
module.exports = { Institution };
