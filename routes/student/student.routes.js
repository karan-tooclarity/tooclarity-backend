const { Router } = require("express");
const { body, param } = require("express-validator");
const { handleValidationErrors } = require("../../middleware/validators");
const {
  getStudentById,
  updateStudentDetails,
  updateAcademicProfile,
  skipOnboarding,
} = require("../../controllers/student/student.controller");

const router = Router();

router.get(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid student ID.")],
  handleValidationErrors,
  getStudentById
);

router.put(
  "/",
  [
    // ---- name ----
    body("name")
      .optional()
      .isString()
      .withMessage("Name must be a string.")
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("Name must be between 2 and 50 characters.")
      .matches(/^[a-zA-Z\s.'-]+$/)
      .withMessage("Name contains invalid characters."),

    // ---- birthday ----
    body("birthday")
      .optional()
      .custom((value) => {
        // Check DD/MM/YYYY format
        const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        if (!regex.test(value)) {
          throw new Error("Birthday must be in DD/MM/YYYY format.");
        }

        const [day, month, year] = value.split("/").map(Number);

        // Validate calendar date
        const parsed = new Date(Date.UTC(year, month - 1, day));
        if (isNaN(parsed.getTime())) {
          throw new Error("Birthday must be a valid date.");
        }

        // Check future date
        if (parsed > new Date()) {
          throw new Error("Birthday cannot be in the future.");
        }

        return true;
      }),

    // ---- profilePictureUrl ----
    body("ProfilePicture")
      .optional()
      .isURL()
      .withMessage("Profile picture must be a valid URL.")
      .matches(
        /^https:\/\/[a-z0-9.-]+\.s3([.-][a-z0-9-]+)?\.amazonaws\.com\/.+$/i
      )
      .withMessage("Profile picture URL must be a valid Amazon S3 bucket URL."),

    // ---- address ----
    body("address")
      .optional()
      .isString()
      .withMessage("Address must be a string.")
      .trim()
      .isLength({ min: 2, max: 200 })
      .withMessage("Address must be between 2 and 200 characters."),
  ],
  handleValidationErrors,
  updateStudentDetails
);

router.put(
  "/academic-profile",
  [
    body("profileType").isIn([
      "KINDERGARTEN",
      "SCHOOL",
      "INTERMEDIATE",
      "GRADUATION",
      "COACHING_CENTER",
      "STUDY_HALLS",
      "TUITION_CENTER",
      "STUDY_ABROAD",
    ]),
    body("details").isObject(),
  ],
  handleValidationErrors,
  updateAcademicProfile
);

router.post(
  "/onboarding-skip",
  skipOnboarding
);


module.exports = router;
