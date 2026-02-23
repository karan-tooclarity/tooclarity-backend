const InstituteAdmin = require("../../models/InstituteAdmin.js");
const { matchedData } = require("express-validator");

// ✅ Reusable schema validation for academic profiles
const validateProfileDetails = (profileType, details) => {
  switch (profileType) {
    case "KINDERGARTEN":
      return ["CURRENTLY_IN", "COMPLETED", "SEEKING_ADMISSION"].includes(
        details.status
      );

    case "SCHOOL":
    case "INTERMEDIATE":
    case "TUITION_CENTER":
      return (
        typeof details.studyingIn === "string" &&
        typeof details.preferredStream === "string"
      );

    case "GRADUATION":
      if (
        details.graduationType === "UNDER_GRADUATE" ||
        details.graduationType === "POST_GRADUATE"
      ) {
        return (
          typeof details.studyingIn === "string" &&
          typeof details.preferredStream === "string"
        );
      }
      return false;

    case "COACHING_CENTER":
      return (
        [
          "UPSKILLING_SKILL_DEVELOPMENT",
          "EXAM_PREPARATION",
          "VOCATIONAL_TRAINING",
        ].includes(details.lookingFor) &&
        typeof details.academicLevel === "string" &&
        typeof details.stream === "string" &&
        typeof details.passoutYear === "string"
      );

    case "STUDY_HALLS":
      return true;

    case "STUDY_ABROAD":
      return (
        typeof details.studyGoals === "string" &&
        typeof details.budgetPerYear === "string" &&
        Array.isArray(details.preferredCountries) &&
        ["YES", "NO", "APPLIED"].includes(details.passportStatus)
      );

    default:
      return false;
  }
};


// ✅ Get a Student by ID
const getStudentById = async (req, res) => {
  try {
    const student = await InstituteAdmin.findOne({
      _id: req.userId,
      role: "STUDENT",
    });

    if (!student) {
      return res.status(404).json({ error: "Student not found." });
    }

    res.status(200).json({ data: student });
  } catch (error) {
    res.status(500).json({ error: "An unexpected error occurred." });
  }
};

// Update Student Details
const updateStudentDetails = async (req, res) => {
  try {
    const updates = matchedData(req, { locations: ["body"] });

    if (updates.birthday) {
      // Expecting format: DD-MM-YYYY
      const parts = updates.birthday.split("/");
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // month index starts from 0
        const year = parseInt(parts[2], 10);

        // Create date as local date (no timezone shift)
        const parsedDate = new Date(Date.UTC(year, month, day, 0, 0, 0));

        if (!isNaN(parsedDate.getTime())) {
          updates.birthday = parsedDate;
        } else {
          delete updates.birthday; // skip invalid
        }
      }
    }

    // Only update allowed fields
    const allowedFields = ["name", "address", "birthday", "ProfilePicture"];
    const safeUpdates = Object.keys(updates)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});

    // Update student
    const student = await InstituteAdmin.findOneAndUpdate(
      { _id: req.userId, role: "STUDENT" },
      { $set: safeUpdates },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ error: "Student not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: student,
    });
  } catch (error) {
    console.error("Error updating student details:", error);
    return res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
};

// ✅ Update Academic Profile
const updateAcademicProfile = async (req, res) => {
  console.log("updateAcademicProfile called with body:", req.body);
  const { profileType, details } = req.body;
  console.log("profileType:", profileType);
  console.log("details:", details);

  if (!validateProfileDetails(profileType, details)) {
    console.log(
      "Validation failed for profileType:",
      profileType,
      "details:",
      details
    );
    return res
      .status(400)
      .json({ error: "Invalid structure for the provided profile details." });
  }

  const academicProfile = { profileType, details };

  try {
    const student = await InstituteAdmin.findOneAndUpdate(
      { _id: req.userId, role: "STUDENT" },
      { $set: { academicProfile, isProfileCompleted: true } },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ error: "Student not found." });
    }

    res.status(200).json({
      message: "Academic profile updated successfully.",
      data: student.academicProfile,
    });
  } catch (error) {
    console.error("Error updating academic profile:", error);
    res.status(500).json({ error: "An unexpected error occurred." });
  }
};

// ✅ Skip Onboarding — simplified
const skipOnboarding = async (req, res) => {
  try {
    const student = await InstituteAdmin.findOneAndUpdate(
      { _id: req.userId, role: "STUDENT" },
      { $set: { isProfileCompleted: true } },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ error: "Student not found." });
    }

    return res.json({
      success: true,
      message: "Onboarding skipped",
    });

  } catch (error) {
    return res.status(500).json({ error: "Failed to skip onboarding" });
  }
};



module.exports = {
  getStudentById,
  updateStudentDetails,
  updateAcademicProfile,
  skipOnboarding,
};
