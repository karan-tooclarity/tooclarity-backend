const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Enquiries = require("./Enquiries");
const crypto = require("crypto");

const instituteAdminSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      // required: [true, 'Name is required.'],
      trim: true,
    },
    email: {
      type: String,
      // required: [true, 'Email is required.'],
      unique: false,
      lowercase: true,
      trim: true,
      sparse: true,
      default: null,
    },
    password: {
      type: String,
      // required: [true, 'Password is required.'],
      minlength: 8,
      select: false,
    },
    passwordChangedAt: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    contactNumber: {
      type: String,
      match: [/^\d{10}$/, "Contact number must be 10 digits"],
      trim: true,
      default: null,
      sparse: true,
      // required: [true, 'Contact number is required']
    },
    designation: {
      type: String,
      // required: [true, 'Designation is required.'],
      trim: true,
    },
    linkedinUrl: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ["INSTITUTE_ADMIN", "ADMIN", "STUDENT"],
      required: true,
    },
    institution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
    },
    ProfilePicture: {
      type: String,
      trim: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    isPaymentDone: {
      type: Boolean,
    },
    isProfileCompleted: {
      type: Boolean,
      default: false,
    },
    address: {
      type: String,
      trim: true,
    },
    birthday: {
      type: Date,
      
    },
    academicProfile: {
      profileType: {
        type: String,
        enum: [
          "KINDERGARTEN",
          "SCHOOL",
          "INTERMEDIATE",
          "GRADUATION",
          "COACHING_CENTER",
          "STUDY_HALLS",
          "TUITION_CENTER",
          "STUDY_ABROAD",
        ],
      },
      details: {
        type: mongoose.Schema.Types.Mixed,
      },
    },
    wishlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
    }],
    programVisited: {
      type: Number,
    },
    requestRaised: {
      type: Number,
    }
}, { timestamps: true});

instituteAdminSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  if (!this.isNew) {
    this.passwordChangedAt = Date.now() - 1000;
  }
  next();
});

instituteAdminSchema.methods.comparePassword = async function (
  candidatePassword
) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

instituteAdminSchema.methods.createPasswordResetToken = function () {
  // 1. Generate a random, unhashed token
  const resetToken = crypto.randomBytes(32).toString("hex");

  // 2. Hash the token before saving it to the database
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // 3. Set the expiration time
  this.passwordResetExpires = Date.now() + 15 * 60 * 1000;

  // 4. Return the unhashed token to be sent to the user
  return resetToken;
};

const InstituteAdmin = mongoose.model("InstituteAdmin", instituteAdminSchema);

module.exports = InstituteAdmin;
