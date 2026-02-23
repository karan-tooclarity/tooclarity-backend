const InstituteAdmin = require("../models/InstituteAdmin");
const otpService = require("../services/otp.service"); // Ensure correct export in otp.service.js
const { validationResult } = require("express-validator");
const AppError = require("../utils/appError");
const redisClient  = require("../utils/redis.util"); 
// const { Institution } = require("../models/Institution"); 
const Course = require("../models/Course"); 
const Branch = require("../models/Branch"); 
const DashboardService = require("../services/dashboard.service");
const { 
    Institution, 
    Kindergarten, 
    School,
    CoachingCenter,
    IntermediateCollege,
    UgPgUniversity,
    StudyHalls,
    TuitionCenters,
    StudyAbroad
} = require("../models/Institution"); 

const {
  // --- L2 COURSE RULES ---
  l2BaseCourseRules,
  l2UgPgCourseRules,
  l2CoachingCourseRules,
  l2TuitionCourseRules,       // ✅ Tuition Centers
  l2StudyHallRules,           // ✅ Study Halls

  // --- L3 DETAILS RULES ---
  kindergartenL3Rules,
  schoolL3Rules,
  intermediateCollegeL3Rules,
  ugPgUniversityL3Rules,
  coachingCenterL3Rules,

  // --- L3 VALIDATOR MIDDLEWARE ---
  validateL3Details
} = require('../middleware/validators');


/**
 * Send OTP for password change
 */
exports.sendPasswordChangeOtp = async (req, res, next) => {
  try {
    console.log("➡️ sendPasswordChangeOtp called, req.userId:", req.userId);

    if (!req.userId) {
      console.log("❌ No userId in request");
      return next(new AppError("Authentication error, user not found.", 401));
    }

    const user = await InstituteAdmin.findById(req.userId).select("email");
    console.log("🔹 Fetched user:", user);

    if (!user || !user.email) {
      console.log("❌ User or email not found");
      return next(new AppError("Authentication error, user not found.", 401));
    }

    if (!otpService.sendPasswordChangeToken) {
      console.log("❌ otpService.sendPasswordChangeToken is undefined!");
      return next(new AppError("OTP service function missing.", 500));
    }

    await otpService.sendPasswordChangeToken(user.email, user.name);
    console.log("✅ OTP sent to email:", user.email);

    res.status(200).json({ success: true, message: "A verification code has been sent to your email." });
  } catch (error) {
    console.error("🔥 Error in sendPasswordChangeOtp:", error);
    next(error);
  }
};

/**
 * Verify OTP for password change
 */
exports.verifyPasswordChangeOtp = async (req, res, next) => {
  try {
    console.log("➡️ verifyPasswordChangeOtp called, req.userId:", req.userId);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("❌ Validation errors:", errors.array());
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    if (!req.userId) {
      console.log("❌ No userId in request");
      return next(new AppError("Authentication error, user not found.", 401));
    }

    const user = await InstituteAdmin.findById(req.userId).select("email");
    console.log("🔹 Fetched user:", user);

    if (!user || !user.email) {
      console.log("❌ User or email not found");
      return next(new AppError("Authentication error, user not found.", 401));
    }

    const { otp } = req.body;
    console.log("🔹 OTP received from request body:", otp);

    if (!otpService.checkPasswordChangeToken) {
      console.log("❌ otpService.checkPasswordChangeToken is undefined!");
      return next(new AppError("OTP service function missing.", 500));
    }

    const isOtpValid = await otpService.checkPasswordChangeToken(user.email, otp);
    console.log("🔹 OTP validation result:", isOtpValid);

    if (!isOtpValid) {
      console.log("❌ OTP invalid or expired for email:", user.email);
      return next(new AppError("The OTP is invalid or has expired.", 400));
    }

    console.log("✅ OTP verified successfully for email:", user.email);
    res.status(200).json({ success: true, message: "OTP verified successfully." });
  } catch (error) {
    console.error("🔥 Error in verifyPasswordChangeOtp:", error);
    next(error);
  }
};

// /**
//  * ✅ NEW: Update user's password after OTP verification
//  */


exports.updatePassword = async (req, res, next) => {
  try {
    console.log("➡️ [updatePassword] - Process started for userId:", req.userId);

    // 1. Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("❌ [updatePassword] - Validation errors:", errors.array());
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // 2. Ensure user is authenticated
    if (!req.userId) {
      console.log("❌ [updatePassword] - Authentication error: req.userId is missing.");
      return next(new AppError("Authentication error. Please log in again.", 401));
    }

    // 3. Find user in the database
    console.log(`🔹 [updatePassword] - Searching for user with ID: ${req.userId}`);
    const user = await InstituteAdmin.findById(req.userId).select("+password");

    if (!user) {
      console.log("❌ [updatePassword] - User not found in the database.");
      return next(new AppError("User not found.", 404));
    }
    console.log("✅ [updatePassword] - User found successfully.");
    
    const { newPassword } = req.body;
    if (!newPassword) {
        console.log("❌ [updatePassword] - 'newPassword' not found in request body.");
        return next(new AppError("New password is required.", 400));
    }

    // 4. ✅ NEW: Verify if the new password is the same as the old one
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      console.log("❌ [updatePassword] - Attempt to use the same password.");
      return next(
        new AppError("New password cannot be the same as your current password.", 400)
      );
    }
    console.log("✅ [updatePassword] - New password is different from the old one.");

    // 5. Set the new password and save
    console.log("➡️ [updatePassword] - Setting new password and preparing to save...");
    user.password = newPassword;
    await user.save();
    console.log("✅ [updatePassword] - New password saved successfully. The pre-save hook should have hashed it.");

    res.status(200).json({ success: true, message: "Password updated successfully." });
    
  } catch (error) {
    console.error("🔥 [updatePassword] - An error occurred in the catch block:", error);
    next(error);
  }
};



/**
 * ✅ NEW: Fetches and groups all data, then sends it directly
 * from memory with headers that tell the browser it's a file.
 * NO temporary file is created on the server.
 */
exports.exportStructuredDataAsFile = async (req, res, next) => {
  try {
    console.log("➡️ [Controller] - Received request for structured data export.");

    // 1. Get structured data from service
    const finalExportData = await DashboardService.getFullStructuredData(req.userId);

    // 2. Convert data to JSON string
    const jsonString = JSON.stringify(finalExportData, null, 2);

    // 3. Set headers to indicate a file download
    res.setHeader('Content-Disposition', 'attachment; filename="full_structured_export.json"');
    res.setHeader('Content-Type', 'application/json');

    console.log("✅ [Controller] - Sending JSON data as a downloadable file.");

    // 4. Send JSON string as file
    res.status(200).send(jsonString);

  } catch (error) {
    console.error("🔥 [Controller] - An error occurred:", error);
    next(error);
  }
};


// dashboard.controller.js

const mongoose = require("mongoose"); // Make sure mongoose is imported at the top
/**
 * Atomically updates institution and course details using a database transaction.
 * It dynamically validates and splits the incoming data based on the institution's type.
 */
exports.updateInstitutionAndCourseDetails = async (req, res, next) => {
    console.log("--- [UPDATE] Received request to update institution and course ---");

    const session = await mongoose.startSession();
    session.startTransaction();
    console.log("🏁 [UPDATE] Mongoose transaction started.");

    try {
        const { institutionId } = req.params;
        const { courseId } = req.body;
        
        console.log("📥 [UPDATE] Raw payload:", req.body);

        // 1. Authorization
        const user = await InstituteAdmin.findById(req.userId);
        if (!user || !user.institution || user.institution.toString() !== institutionId) {
            throw new AppError('Forbidden: You do not have permission to modify this resource.', 403);
        }
        console.log("👤 [UPDATE] User authorized successfully.");

        // 2. Fetch institution to determine its type
        const institution = await Institution.findById(institutionId).session(session);
        if (!institution) {
            throw new AppError('Institution not found.', 404);
        }
        console.log(`🏢 [UPDATE] Institute Type: "${institution.instituteType}"`);

        // 3. Pre-validation Data Conversion
        const booleanFields = ['extendedCare', 'mealsProvided', 'outdoorPlayArea', 'placementDrives', 'mockInterviews', 'resumeBuilding', 'linkedinOptimization', 'exclusiveJobPortal', 'library', 'hostelFacility', 'playground', 'busService', 'certification','entranceExam','managementQuota'];
        booleanFields.forEach(field => {
            if (req.body[field] !== undefined) {
                req.body[field] = (req.body[field] === 'Yes');
            }
        });
        console.log("✨ [UPDATE] Payload after boolean conversion:", req.body);

        // 4. Dynamic Backend Validation
        let validationRules = [];
        switch (institution.instituteType) {
            case 'Kindergarten/childcare center':
                validationRules = [...l2BaseCourseRules, ...kindergartenL3Rules];
                break;
            case "School's":
                validationRules = [...l2BaseCourseRules, ...schoolL3Rules];
                break;
            case 'Intermediate college(K12)':
                validationRules = [...l2BaseCourseRules, ...intermediateCollegeL3Rules];
                break;
            case 'Under Graduation/Post Graduation':
                validationRules = [...l2UgPgCourseRules, ...ugPgUniversityL3Rules];
                break;
            case 'Coaching centers':
                validationRules = [...l2CoachingCourseRules, ...coachingCenterL3Rules];
                break;
            case 'Study Halls':
                validationRules = l2StudyHallRules;
                break;
            case "Tution Center's":
                validationRules = l2TuitionCourseRules;
                break;
            case "Study Abroad":
                // Assuming base course rules apply, add specific Study Abroad rules if created
                validationRules = [...l2BaseCourseRules];
                break;
        }

        if (validationRules.length > 0) {
            await Promise.all(validationRules.map(rule => rule.run(req)));
            const validationErrors = validationResult(req);
            if (!validationErrors.isEmpty()) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, errors: validationErrors.array() });
            }
        }
        console.log("✅ Backend validation passed successfully.");

        // 5. Data Splitting
        const institutionUpdateData = {};
        const courseUpdateData = {};
        const fieldMappings = {
            'Kindergarten/childcare center': {
                institution: ['schoolType', 'curriculumType', 'openingTime', 'closingTime', 'operationalDays', 'extendedCare', 'mealsProvided', 'outdoorPlayArea'],
                course: ['courseName', 'aboutCourse', 'courseDuration', 'mode', 'priceOfCourse', 'location', 'image', 'brochure'],
            },
            'School\'s': {
                institution: ['schoolType', 'schoolCategory', 'curriculumType', 'operationalDays', 'otherActivities', 'hostelFacility', 'playground', 'busService'],
                course: ['courseName', 'aboutCourse', 'courseDuration', 'mode', 'priceOfCourse', 'location', 'image', 'brochure'],
            },
            'Intermediate college(K12)': {
                institution: ['collegeType', 'collegeCategory', 'curriculumType', 'operationalDays', 'otherActivities', 'hostelFacility', 'playground', 'busService'],
                course: ['courseName', 'aboutCourse', 'courseDuration', 'mode', 'priceOfCourse', 'location'],
            },
            'Under Graduation/Post Graduation': {
                institution: [ 'ownershipType', 'collegeCategory', 'affiliationType', 'placementDrives', 'mockInterviews', 'resumeBuilding', 'linkedinOptimization', 'exclusiveJobPortal', 'library', 'hostelFacility', 'entranceExam', 'managementQuota', 'playground', 'busService', 'certification'],
                course: ['courseName', 'aboutCourse', 'courseDuration', 'mode', 'priceOfCourse', 'eligibilityCriteria','location', 'graduationType', 'streamType', 'selectBranch', 'aboutBranch', 'educationType', 'classSize'],
            },
            'Coaching centers': {
                institution: ['placementDrives', 'mockInterviews', 'resumeBuilding', 'linkedinOptimization', 'exclusiveJobPortal', 'certification'],
                course: ['courseName', 'aboutCourse', 'categoriesType', 'domainType', 'mode', 'courseDuration', 'priceOfCourse', 'location', 'classSize']
            },
            'Study Halls': {
                institution: [],
                course: ['hallName', 'seatingOption', 'openingTime', 'closingTime', 'operationalDays', 'totalSeats', 'availableSeats', 'pricePerSeat', 'hasWifi', 'hasChargingPoints', 'hasAC', 'hasPersonalLocker']
            },
            "Tution Center's": {
                institution: [],
                course: ['tuitionType', 'instructorProfile', 'subject', 'totalSeats', 'availableSeats', 'operationalDays', 'openingTime', 'closingTime', 'pricePerSeat']
            },
            'Study Abroad': {
                institution: ['consultancyName', 'totalAdmissions', 'countries', 'academicOfferings'],
                course: ['courseName', 'aboutCourse', 'courseDuration', 'mode', 'priceOfCourse', 'location', 'image', 'brochure']
            }
        };
        
        const currentMapping = fieldMappings[institution.instituteType] || { institution: [], course: [] };
        const placementFields = ['placementDrives', 'mockInterviews', 'resumeBuilding', 'linkedinOptimization', 'exclusiveJobPortal', 'certification'];

        for (const key in req.body) {
            if (currentMapping.institution.includes(key)) {
                if (placementFields.includes(key) && institution.instituteType === 'Under Graduation/Post Graduation') {
                    institutionUpdateData[`placements.${key}`] = req.body[key];
                } else {
                    institutionUpdateData[key] = req.body[key];
                }
            } else if (currentMapping.course.includes(key)) {
                courseUpdateData[key] = req.body[key];
            }
        }

        console.log("📊 [UPDATE] Data split for INSTITUTION:", institutionUpdateData);
        console.log("📊 [UPDATE] Data split for COURSE:", courseUpdateData);

        // 6. Model and Database Update
        let InstitutionModel;
        switch (institution.instituteType) {
            case 'Kindergarten/childcare center': InstitutionModel = Kindergarten; break;
            case 'School\'s': InstitutionModel = School; break;
            case 'Coaching centers': InstitutionModel = CoachingCenter; break;
            case 'Intermediate college(K12)': InstitutionModel = IntermediateCollege; break;
            case 'Under Graduation/Post Graduation': InstitutionModel = UgPgUniversity; break;
            case 'Study Halls': InstitutionModel = StudyHalls; break;
            case "Tution Center's": InstitutionModel = TuitionCenters; break;
            case 'Study Abroad': InstitutionModel = StudyAbroad; break;
            default: InstitutionModel = Institution; break;
        }
        const [updatedInstitution, updatedCourse] = await Promise.all([
            // Only update institution if there's data for it
            Object.keys(institutionUpdateData).length > 0
                ? InstitutionModel.findByIdAndUpdate(institutionId, { $set: institutionUpdateData }, { new: true, runValidators: true, session })
                : Promise.resolve(institution),
            // Only update course if there's data for it
            Object.keys(courseUpdateData).length > 0
                ? Course.findOneAndUpdate({ _id: courseId, institution: institutionId }, { $set: courseUpdateData }, { new: true, runValidators: true, session })
                : Promise.resolve(await Course.findById(courseId).session(session))
        ]);

        if (!updatedCourse || !updatedInstitution) {
            throw new AppError('Could not find course or institution to update.', 404);
        }
        console.log("💾 [UPDATE] Database update successful.");
        
        // 7. Commit Transaction
        await session.commitTransaction();
        console.log("✅ [UPDATE] Transaction successful. Committing changes.");

        res.status(200).json({
            success: true,
            message: "Details updated successfully!",
            data: { institution: updatedInstitution, course: updatedCourse },
        });

    } catch (error) {
        await session.abortTransaction();
        console.error("🔥 [UPDATE] Transaction aborted due to error:", error);
        next(error);
    } finally {
        session.endSession();
        console.log("🛑 [UPDATE] Mongoose session ended.");
    }
};