const InstituteAdmin = require("../models/InstituteAdmin");
const otpService = require("../services/otp.service");
const { promisify } = require("util");
const AppError = require("../utils/appError");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Session = require("../models/Session");

const CookieUtil = require("../utils/cookie.util");
const RedisUtil = require("../utils/redis.util");

const { sendTokens } = require("../utils/token.utils");

exports.register = async (req, res, next, options = {}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      name,
      email,
      password,
      contactNumber,
      designation,
      linkedin,
      type,
      googleId,
    } = req.body;

    // ---- Helper functions ----
    const abort = async (status, message) => {
      await session.abortTransaction();
      session.endSession();
      return res.status(status).json({ status: "fail", message });
    };

    const checkDuplicateUser = async (filter) =>
      await InstituteAdmin.findOne(filter).session(session);

    const sendOtp = async () => {
      try {
        if (type === "institution")
          await otpService.sendVerificationToken(email, name);
        else if (type === "student")
          await otpService.sendVerificationTokenSMS(contactNumber);
      } catch {
        throw new Error("OTP_SEND_FAILED");
      }
    };

    // ---- Validation ----
    let existingUser;
    if (googleId) {
      if ((existingUser = await checkDuplicateUser({ googleId }))) {
        console.log("Google ID already in use.");
        throw new Error("GOOGLE_ID_EXISTS");
      }
      if ((existingUser = await checkDuplicateUser({ email }))) {
        console.log("Email already in Use.");
        throw new Error("EMAIL_EXISTS");
      }
    }
    if (type === "institution") {
      const query = [];
      if (email) query.push({ email });
      if (contactNumber) query.push({ contactNumber });
      if (query.length > 0) {
        existingUser = await checkDuplicateUser({ $or: query });
      }
      if (existingUser) {
        const conflictField =
          existingUser.email === email ? "Email" : "Contact number";

        if (options.returnTokens)
          throw new Error(`${conflictField.toUpperCase()}_EXISTS`);

        return await abort(409, `${conflictField} already in use.`);
      }
    } else if (type === "student" && !googleId) {
      existingUser = await checkDuplicateUser({ contactNumber });
      if (existingUser) {
        if (options.returnTokens) throw new Error("CONTACT_EXISTS");
        return await abort(409, "Contact number already in use.");
      }
    } else if (!["institution", "student", "admin"].includes(type)) {
      if (options.returnTokens) throw new Error("INVALID_USER_TYPE");
      return await abort(400, "Invalid user type.");
    }

    // ---- User creation payload ----
    const userPayload = {
      name: name || null,
      email: email || null,
      password: password || undefined,
      contactNumber: contactNumber || null,
      designation: designation || undefined,
      linkedinUrl: linkedin || null,
      googleId: googleId || undefined,
      ProfilePicture: null,
      isEmailVerified: !!googleId,
      isPhoneVerified: false,
      isProfileCompleted: false,
    };

    switch (type) {
      case "institution":
        Object.assign(userPayload, {
          role: "INSTITUTE_ADMIN",
          isPaymentDone: false,
          address: undefined,
          birthday: undefined,
          requestRaised: undefined,
          programVisited: undefined,
        });
        break;

      case "student":
        Object.assign(userPayload, {
          role: "STUDENT",
          isPaymentDone: undefined,
          address: null,
          birthday: null,
          requestRaised: 0,
          programVisited: 0,
        });
        break;

      case "admin":
        Object.assign(userPayload, {
          role: "ADMIN",
          birthday: undefined,
          programVisited: undefined,
          requestRaised: undefined,
        });
        break;
    }

    // ---- Create user ----
    const [newUser] = await InstituteAdmin.create([userPayload], { session });

    // ---- OTP sending ----
    if (
      !googleId &&
      !options.returnTokens &&
      ["institution", "student"].includes(type)
    ) {
      try {
        await sendOtp();
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({
          status: "fail",
          message: "Failed to send OTP. User not registered.",
        });
      }

      await session.commitTransaction();
      session.endSession();
      return res.status(201).json({
        status: "success",
        message: `OTP sent to ${
          type === "student" ? "phone" : "email"
        }. Please verify to complete registration.`,
      });
    }

    // ---- Commit + Token ----
    await session.commitTransaction();
    session.endSession();

    const tokenData = await sendTokens(
      newUser,
      res,
      `${type.toUpperCase()} REGISTERED SUCCESSFULLY`,
      options
    );

    // Enqueue welcome notification per role
    try {
      const { addNotificationJob } = require("../jobs/notification.job");
      const title = "Welcome to TooClarity";
      const description = `Hi ${newUser.name}, your account has been created.`;
      if (newUser.role === "INSTITUTE_ADMIN") {
        await addNotificationJob({
          title,
          description,
          category: "system",
          recipientType: "ADMIN",
          institutionAdmin: newUser._id,
        });
      } else if (newUser.role === "STUDENT") {
        await addNotificationJob({
          title,
          description,
          category: "system",
          recipientType: "STUDENT",
          student: newUser._id,
        });
      } else if (newUser.role === "ADMIN") {
        await addNotificationJob({
          title,
          description,
          category: "system",
          recipientType: "ADMIN",
          institutionAdmin: newUser._id,
        });
      }
    } catch (_) {}

    // Enqueue welcome notification per role
    try {
      const { addNotificationJob } = require("../jobs/notification.job");
      const title = "Welcome to TooClarity";
      const description = `Hi ${newUser.name}, your account has been created.`;
      if (newUser.role === "INSTITUTE_ADMIN") {
        await addNotificationJob({
          title,
          description,
          category: "system",
          recipientType: "ADMIN",
          institutionAdmin: newUser._id,
        });
      } else if (newUser.role === "STUDENT") {
        await addNotificationJob({
          title,
          description,
          category: "system",
          recipientType: "STUDENT",
          student: newUser._id,
        });
      } else if (newUser.role === "ADMIN") {
        await addNotificationJob({
          title,
          description,
          category: "system",
          recipientType: "ADMIN",
          institutionAdmin: newUser._id,
        });
      }
    } catch (_) {}

    // ✅ If Google OAuth flow → return tokens only
    if (options.returnTokens) return tokenData;

    return res.status(201).json({
      status: "success",
      message: "User registered successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    // Handle OTP-specific errors gracefully
    if (error.message === "OTP_SEND_FAILED") {
      return res.status(500).json({
        status: "fail",
        message: "Failed to send OTP. User not registered.",
      });
    }

    // next(error);
    if (!options.returnTokens) {
      next(error);
    } else {
      throw error;
    }
  }
};

exports.verifyEmailOtp = async (req, res, next) => {
  try {
    const { email, otp, contactNumber, isLogin } = req.body;

    if (!otp || (!email && !contactNumber)) {
      return res.status(400).json({
        status: "fail",
        message: "OTP and either email or contact number are required.",
      });
    }

    const isOtpValid = await otpService.checkVerificationToken(
      email,
      contactNumber,
      otp
    );
    if (!isOtpValid) {
      return res
        .status(400)
        .json({ status: "fail", message: "Incorrect or expired OTP." });
    }

    const query = email ? { email } : { contactNumber };
    const user = await InstituteAdmin.findOne(query);

    if (!user) {
      return res
        .status(404)
        .json({ status: "fail", message: "User not found." });
    }

    if( isLogin && contactNumber){
      return sendTokens(user, res, "Login successfully.");
    }

    if (email) {
      if (user.isEmailVerified) {
        return res
          .status(400)
          .json({ status: "fail", message: "Email is already verified." });
      }
      user.isEmailVerified = true;
    }

    if (contactNumber) {
      if (user.isPhoneVerified) {
        return res.status(400).json({
          status: "fail",
          message: "Phone number is already verified.",
        });
      }
      user.isPhoneVerified = true;
    }
    await user.save();
    return await sendTokens(user, res, "OTP verified successfully.");
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next, options = {}) => {
  try {
    const { email, password, googleId, contactNumber, type } = req.body;
    let user;

    // ✅ If Google login — keep it completely intact
    if (googleId) {
      user = await InstituteAdmin.findOne({ email, googleId });

      if (!user) {
        if (options.returnTokens) {
          const err = new Error("No account found for this Google user.");
          err.code = "USER_NOT_FOUND";
          throw err;
        }
        return res.status(404).json({
          status: "fail",
          message:
            "No account found for this Google user. Please register first.",
        });
      }

      // 🚫 Restrict cross-role login (important)
      if (
        (type === "student" && user.role === "INSTITUTE_ADMIN") ||
        (type === "institution" && user.role === "STUDENT")
      ) {
        const errMsg = "This account belongs to a different user type.";
        if (options.returnTokens) {
          const err = new Error(errMsg);
          err.code = "ROLE_MISMATCH";
          throw err;
        }
        return res.status(403).json({
          status: "fail",
          message: errMsg,
        });
      }

      return await sendTokens(user, res, "Login successful.", options);
    }

    if (type === "institution" || type === "admin") {
      user = await InstituteAdmin.findOne({ email }).select("+password");
      const invalid = !user || !(await user.comparePassword(password));

      if (invalid) {
        if (options.returnTokens) {
          const err = new Error("Incorrect email or password.");
          err.code = "INVALID_CREDENTIALS";
          throw err;
        }
        return res.status(401).json({
          status: "fail",
          message: "Incorrect email or password.",
        });
      }

      if (user.role === "INSTITUTE_ADMIN" && !user.isEmailVerified) {
        if (options.returnTokens) {
          const err = new Error(
            "Account not verified. Please verify your email."
          );
          err.code = "EMAIL_NOT_VERIFIED";
          throw err;
        }
        return res.status(403).json({
          status: "fail",
          message: "Account not verified. Please verify your Email first.",
        });
      }

      if (user.role === "STUDENT" && type === "institution") {
        const errMsg = "This account belongs to a student, not an institution.";
        if (options.returnTokens) {
          const err = new Error(errMsg);
          err.code = "ROLE_MISMATCH";
          throw err;
        }
        return res.status(403).json({
          status: "fail",
          message: errMsg,
        });
      }
    } else if (type === "student") {
      user = await InstituteAdmin.findOne({ contactNumber });
      const invalid = !user;

      if (invalid) {
        if (options.returnTokens) {
          const err = new Error("Incorrect contact number");
          err.code = "INVALID_CREDENTIALS";
          throw err;
        }
        return res.status(401).json({
          status: "fail",
          message: "Incorrect contact number",
        });
      }

      if (user.role === "INSTITUTE_ADMIN" && type === "student") {
        const errMsg = "This account belongs to an institution, not a student.";
        if (options.returnTokens) {
          const err = new Error(errMsg);
          err.code = "ROLE_MISMATCH";
          throw err;
        }
        return res.status(403).json({
          status: "fail",
          message: errMsg,
        });
      }

      await otpService.sendVerificationTokenSMS(contactNumber);

      return res.status(200).json({
        status: "success",
        message: "OTP sent successfully to your registered mobile number.",
      });
    } else {
      return res.status(400).json({
        status: "fail",
        message: "Invalid user type provided.",
      });
    }

    return await sendTokens(user, res, "Login successful.", options);
  } catch (error) {
    if (!options.returnTokens) {
      next(error);
    } else {
      throw error;
    }
  }
};

exports.logout = async (req, res, next) => {
  const userId = req.userId;
  const sessionId = req.sessionId;
  try {
    RedisUtil.deleteAccessToken(sessionId);
    CookieUtil.clearAllCookies(res);
    await Session.deleteOne({ userId });
    return res.status(200).json({
      status: "success",
      message: "Logged out successfully.",
    });
  } catch (err) {
    console.log(err.message);
  }
};

/**
 * @desc    Initiate password reset process by sending a link
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return next(new AppError("Please provide an email address.", 400));
    }

    const user = await InstituteAdmin.findOne({ email });

    if (user) {
      // 1. Generate the unhashed token using the model method
      const resetToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });

      // 2. Create the full reset URL
      const resetURL = `${process.env.CLIENT_ORIGIN_WEB}/reset-password/${resetToken}`;

      // 3. Send the email with the link
      try {
        await otpService.sendPasswordResetLink(user.email, user.name, resetURL);
      } catch (error) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });
        return next(
          new AppError("Failed to send email. Please try again later.", 500)
        );
      }
    }

    res.status(200).json({
      status: "success",
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset user's password using the token from the link
 * @route   PATCH /api/auth/reset-password/:token
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { password, passwordConfirm } = req.body;

    // 1. Hash the token from the URL parameter
    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    // 2. Find the user by the hashed token and check if it's not expired
    const user = await InstituteAdmin.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+password");

    if (!user) {
      return next(new AppError("Token is invalid or has expired.", 400));
    }

    if (password !== passwordConfirm) {
      return next(new AppError("Passwords do not match.", 400));
    }

    if (password.length < 8) {
      return next(
        new AppError("Password must be at least 8 characters long.", 400)
      );
    }

    const isSamePassword = await user.comparePassword(password);
    if (isSamePassword) {
      return next(
        new AppError(
          "Your new password must be different from your old password.",
          400
        )
      );
    }

    // 3. Set the new password
    user.password = password;

    // 4. Invalidate the reset token (CRITICAL for one-time use)
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    // The pre-save middleware will automatically hash the new password and set passwordChangedAt
    await user.save();

    // 5. Send confirmation email
    await otpService.sendPasswordChangedConfirmation(user.email, user.name);

    res.status(200).json({
      status: "success",
      message: "Password has been reset successfully. Please log in.",
    });
  } catch (error) {
    next(error);
  }
};

exports.resendOtp = async (req, res, next) => {
  try {
    const { email, contactNumber } = req.body;
    if (!email && !contactNumber) {
      return res.status(400).json({
        status: "fail",
        message: "Either email or contact number must be provided.",
      });
    }
    if (email) {
      await otpService.sendVerificationToken(email);
      return res.status(200).json({
        status: "success",
        message: "OTP resent to email successfully.",
      });
    } else if (contactNumber) {
      await otpService.sendVerificationTokenSMS(contactNumber);
      return res.status(200).json({
        status: "success",
        message: "OTP resent to contact number successfully.",
      });
    }
  } catch (error) {
    next(error);
  }
};

exports.updatePhoneNumber = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { contactNumber, email, userName } = req.body;

    if (!contactNumber && !email) {
      return res.status(400).json({
        status: "fail",
        message: "Phone number or email cannot be empty",
      });
    }

    // Prepare update data based on what's provided
    const updateData = {};
    let updateType = "";
    let otpRecipient = "";
    let successMessage = "";

    if (contactNumber) {
      updateData.contactNumber = contactNumber;
      updateData.isPhoneVerified = false;
      updateType = "contactNumber";
      otpRecipient = contactNumber;
      successMessage = "Phone number updated successfully";
    } else if (email) {
      updateData.email = email;
      updateData.isEmailVerified = false;
      updateType = "email";
      otpRecipient = email;
      successMessage = "Email updated successfully";
    }

    // Get original user data for rollback if needed
    const originalUser = await InstituteAdmin.findById(userId);

    if (!originalUser) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    // Check if the new contact number or email is already used by another user
    if (contactNumber) {
      const existingUserWithPhone = await InstituteAdmin.findOne({
        contactNumber: contactNumber,
        _id: { $ne: userId }, // Exclude current user
      });

      if (existingUserWithPhone) {
        return res.status(409).json({
          status: "fail",
          message: "Contact number is already use",
        });
      }
    } else if (email) {
      const existingUserWithEmail = await InstituteAdmin.findOne({
        email: email,
        _id: { $ne: userId }, // Exclude current user
      });

      if (existingUserWithEmail) {
        return res.status(409).json({
          status: "fail",
          message: "Email is already in Use",
        });
      }
    }

    // Update user and return the updated document
    const updatedUser = await InstituteAdmin.findByIdAndUpdate(
      userId,
      updateData,
      { new: true } // returns updated document
    );

    if (!updatedUser) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    // Send OTP based on update type with error handling
    try {
      if (contactNumber) {
        await otpService.sendVerificationTokenSMS(contactNumber);
      } else if (email) {
        await otpService.sendVerificationToken(
          email,
          userName || updatedUser.name
        );
      }
    } catch (otpError) {
      // Revert database changes if OTP sending fails
      const revertData = {};
      if (contactNumber) {
        revertData.contactNumber = originalUser.contactNumber;
        revertData.isPhoneVerified = originalUser.isPhoneVerified;
      } else if (email) {
        revertData.email = originalUser.email;
        revertData.isEmailVerified = originalUser.isEmailVerified;
      }

      await InstituteAdmin.findByIdAndUpdate(userId, revertData);
      throw otpError; // Re-throw the OTP error
    }

    return res.status(200).json({
      status: "success",
      message: successMessage,
      data: updatedUser,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};
