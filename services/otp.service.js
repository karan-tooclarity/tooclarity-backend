const crypto = require("crypto");
const axios = require("axios");
const logger = require("../config/logger");
const AppError = require("../utils/appError");
const RedisUtil = require("../utils/redis.util");

const sendEmail = async (to, templateId, variables = {}) => {
  try {
    const payload = {
      recipients: [
        {
          to: [{ email: to }],
          variables, // dynamic values for placeholders in template
        },
      ],
      from: {
        email: process.env.MSG91_EMAIL_FROM,
        name: process.env.MSG91_EMAIL_NAME || "TooClarity",
      },
      domain: process.env.MSG91_EMAIL_DOMAIN,
      template_id: templateId,
    };

    const response = await axios.post(process.env.MSG91_EMAIL_URL, payload, {
      headers: {
        authkey: process.env.MSG91_API_KEY,
        "Content-Type": "application/json",
      },
    });

    logger.info({ event: "msg91_email_sent", to }, "✅ MSG91 Email Sent");
    return response.data;
  } catch (error) {
    const errData = error.response?.data;

    console.error("❌ MSG91 Email Sending Failed:");
    if (errData?.errors) {
      console.error(
        "Detailed Errors:",
        JSON.stringify(errData.errors, null, 2)
      );
    } else if (errData?.message) {
      console.error("Message:", errData.message);
    } else {
      console.error(error.message);
    }

    logger.error(
      { err: errData || error.message, event: "msg91_email_failed", to },
      "❌ MSG91 Email Sending Failed"
    );
    throw new Error("Email sending failed via MSG91");
  }
};

const sendOtpSMSFlow = async (phoneNumber, variables) => {
  try {
    const payload = {
      template_id: process.env.MSG91_SMS_TEMPLATE_ID,
      mobile: phoneNumber,
      ...variables,
    };
    console.log(payload);

    const response = await axios.post(process.env.MSG91_SMS_URL, payload, {
      headers: {
        authkey: process.env.MSG91_API_KEY,
        "Content-Type": "application/json",
      },
    });
    console.log(response.data);

    logger.info(
      { event: "msg91_sms_sent", phoneNumber },
      "MSG91 OTP SMS sent successfully."
    );

    return response.data;
  } catch (error) {
    const errData = error.response?.data;

    console.error("❌ MSG91 SMS Sending Failed:");
    if (errData?.errors) {
      console.error(
        "Detailed Errors:",
        JSON.stringify(errData.errors, null, 2)
      );
    } else if (errData?.message) {
      console.error("Message:", errData.message);
    } else {
      console.error(error.message);
    }

    logger.error(
      { err: errData || error.message, event: "msg91_sms_failed", phoneNumber },
      "❌ MSG91 OTP SMS failed."
    );
    throw new AppError("MSG91 SMS sending failed.", 500);
  }
};

exports.generateOtp = () => {
  const otpLength = parseInt(process.env.OTP_LENGTH, 10) || 6;
  return crypto
    .randomInt(0, Math.pow(10, otpLength))
    .toString()
    .padStart(otpLength, "0");
};

exports.sendVerificationTokenSMS = async (phoneNumber, name) => {
  try {
    const phoneNumberWithCountryCode = `91${phoneNumber}`;
    const redisKey = `sms:${phoneNumber}`;
    const expirySeconds = 10 * 60; // 10 minutes

    logger.info(
      { event: "otp_sms_start", phoneNumber },
      "🟡 Starting OTP SMS generation process."
    );

    // 🔹 1. Check Redis if OTP already exists
    let otp = await RedisUtil.getOtp(redisKey);

    if (otp) {
      logger.info(
        { event: "otp_redis_found", phoneNumber, otp },
        "🟢 Existing OTP found in Redis. Reusing it."
      );
    } else {
      // 🔹 2. Generate new OTP
      otp = this.generateOtp();

      logger.info(
        { event: "otp_generated", phoneNumber, otp },
        "✅ OTP generated successfully."
      );

      // 🔹 3. Save new OTP into Redis
      logger.info(
        { event: "otp_redis_save_start", redisKey, otp, expirySeconds },
        "🟡 Saving OTP into Redis."
      );

      await RedisUtil.saveOtp(redisKey, otp, expirySeconds);

      logger.info(
        { event: "otp_redis_save_success", redisKey },
        "✅ OTP successfully saved into Redis."
      );
    }

    // 🔹 4. Prepare variables for SMS
    const variables = {
      OTP: otp,
      // name: name || "User",
      // app_name: appName,
      // expiry_minutes: expirySeconds / 60,
    };

    logger.info(
      { event: "otp_sms_send_start", phoneNumberWithCountryCode, variables },
      "🟡 Sending OTP via MSG91 flow."
    );

    // 🔹 5. Send SMS using MSG91 flow
    await sendOtpSMSFlow(phoneNumberWithCountryCode, variables);

    logger.info(
      { event: "otp_sms_sent", phoneNumber },
      "✅ OTP SMS sent successfully (business layer)."
    );

    return true;
  } catch (error) {
    logger.error(
      { err: error, event: "otp_sms_failed", phoneNumber },
      "❌ OTP SMS sending failed (business layer)."
    );
    throw new AppError("Could not send OTP via SMS.", 500);
  }
};

exports.sendVerificationToken = async (email, name) => {
  try {
    const templateId = process.env.MSG91_TEMPLATE_ID;
    const redisKey = `email:${email}`;
    const expirySeconds = 10 * 60; // 10 minutes

    logger.info(
      { event: "otp_email_start", email },
      "🟡 Starting OTP email generation process."
    );

    // 🔹 1. Check Redis for existing OTP
    let otp = await RedisUtil.getOtp(redisKey);

    if (otp) {
      logger.info(
        { event: "otp_redis_found", email, otp },
        "🟢 Existing OTP found in Redis. Reusing it."
      );
    } else {
      // 🔹 2. Generate new OTP
      otp = this.generateOtp();

      logger.info(
        { event: "otp_generated", email, otp },
        "✅ New OTP generated successfully."
      );

      // 🔹 3. Save OTP into Redis
      await RedisUtil.saveOtp(redisKey, otp, expirySeconds);

      logger.info(
        { event: "otp_redis_save_success", redisKey },
        "✅ OTP successfully saved into Redis."
      );
    }

    // 🔹 4. Prepare variables for email template
    const variables = {
      otp,
      name,
      expiry_minutes: expirySeconds / 60,
      year: new Date().getFullYear(),
    };

    logger.info(
      { event: "otp_email_send_start", email, variables },
      "🟡 Sending OTP via MSG91 email flow."
    );

    // 🔹 5. Send email using MSG91 template
    await sendEmail(email, templateId, variables);

    logger.info(
      { event: "otp_sent", email },
      "✅ OTP email sent successfully (business layer)."
    );

    return true;
  } catch (error) {
    logger.error(
      { err: error, event: "otp_failed", email },
      "❌ OTP email sending failed (business layer)."
    );
    throw new AppError("Could not send OTP.", 500);
  }
};

exports.checkVerificationToken = async (email, phoneNumber, code) => {
  try {
    let key;
    if (email) {
      key = `email:${email}`;
    } else if (phoneNumber) {
      key = `sms:${phoneNumber}`;
    } else {
      throw new AppError("Either email or phone number must be provided.", 400);
    }

    const isValid = await RedisUtil.validateOtp(key, code);

    if (isValid) {
      logger.info(
        { event: "otp_verified", email, phoneNumber },
        "✅ OTP verified successfully."
      );
      return true;
    } else {
      logger.warn(
        { event: "otp_invalid", email, phoneNumber },
        "⚠️ OTP invalid or expired."
      );
      return false;
    }
  } catch (error) {
    logger.error(
      { err: error, event: "otp_check_error", email, phoneNumber },
      "❌ OTP check failed."
    );
    return false;
  }
};

exports.sendPaymentSuccessEmail = async (options) => {
  const { email, name, amount, orderId, date } = options;
  const templateId = process.env.MSG91_PAYMENT_TEMPLATE_ID;

  try {
    // Format date
    const formattedDate = new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const year = new Date().getFullYear();

    const variables = {
      name,
      amount: (amount / 100).toFixed(2), // convert cents/paise to main currency
      order_id: orderId,
      date: formattedDate,
      year,
    };

    // Send email using MSG91 template
    await sendEmail(email, templateId, variables);

    logger.info(
      { event: "payment_success_email_sent", email, orderId },
      "✅ Payment success email sent using template."
    );

    return true;
  } catch (error) {
    logger.error(
      { err: error, event: "payment_email_failed", email, orderId },
      "❌ Payment email sending failed."
    );
    return false;
  }
};

exports.sendPasswordChangeToken = async (email, name) => {
  const passwordChangeTemplateId =
    process.env.MSG91_PASSWORD_CHANGE_TEMPLATE_ID;
  try {
    const otp = this.generateOtp();
    const expirySeconds = 10 * 60; // 10 minutes
    await RedisUtil.saveOtp(`password-change:${email}`, otp, expirySeconds);

    const variables = {
      name,
      otp,
      expiry_minutes: expirySeconds / 60, // 10 minutes
      year: new Date().getFullYear(),
    };

    await sendEmail(email, passwordChangeTemplateId, variables);

    logger.info(
      { event: "password_otp_sent", email },
      "✅ Password change OTP sent."
    );
    return true;
  } catch (error) {
    logger.error(
      { err: error, event: "password_otp_failed", email },
      "❌ Password change OTP failed."
    );
    throw new AppError("Could not send verification code.", 500);
  }
};

exports.checkPasswordChangeToken = async (email, otp) => {
  try {
    const redisKey = `password-change:${email}`;
    const isValid = await RedisUtil.validateOtp(redisKey, otp);

    if (isValid) {
      await RedisUtil.deleteOtp(redisKey);
      logger.info(
        { event: "password_otp_verified", email },
        "Password OTP verified."
      );
      return true;
    } else {
      logger.warn(
        { event: "password_otp_invalid", email },
        "Password OTP invalid/expired."
      );
      return false;
    }
  } catch (error) {
    logger.error(
      { err: error, event: "password_otp_check_error", email },
      "Password OTP check failed."
    );
    return false;
  }
};

exports.sendPasswordResetLink = async (email, name, resetURL) => {
  const passwordResetTemplateId = process.env.MSG91_PASSWORD_RESET_TEMPLATE_ID;
  try {
    const expiryMinutes = 15; // Link valid for 15 minutes

    const variables = {
      name,
      reset_link: resetURL,
      expiry_minutes: expiryMinutes,
      year: new Date().getFullYear(),
    };

    await sendEmail(email, passwordResetTemplateId, variables);

    logger.info(
      { event: "password_reset_link_sent", email },
      "✅ Password reset link sent."
    );
    return true;
  } catch (error) {
    logger.error(
      { err: error, event: "password_reset_link_failed", email },
      "❌ Password reset link failed."
    );
    throw new AppError("Could not send password reset link.", 500);
  }
};

exports.sendPasswordChangedConfirmation = async (email, name) => {
  const passwordChangeConfirmTemplateId =
    process.env.MSG91_PASSWORD_CHANGE_CONFIRM_TEMPLATE_ID;
  try {
    const variables = {
      name,
      year: new Date().getFullYear(),
    };

    await sendEmail(email, passwordChangeConfirmTemplateId, variables);

    logger.info(
      { event: "password_change_confirm_sent", email },
      "✅ Password change confirmation sent."
    );
  } catch (error) {
    logger.error(
      { err: error, event: "password_change_confirm_failed", email },
      "❌ Password change confirmation failed."
    );
  }
};
