const {
  body,
  param,
  query,
  validationResult,
  matchedData,
} = require("express-validator");
const logger = require("../config/logger");

// --- UTILITY FUNCTION ---
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
};

// --- AUTH VALIDATORS ---
const strongPasswordOptions = {
  minLength: 8,
  minLowercase: 1,
  minUppercase: 1,
  minNumbers: 1,
  minSymbols: 1,
};

exports.validateRegistration = [
  // Email → only required for institution
  body("email")
    .if((value, { req }) => req.body.type === "institution")
    .notEmpty()
    .withMessage("Email is required for institutions.")
    .bail()
    .isEmail()
    .withMessage("A valid email is required.")
    .normalizeEmail(),

  // Name → only required for institution
  body("name")
    .if((value, { req }) => req.body.type === "institution")
    .notEmpty()
    .withMessage("Name is required for institutions.")
    .trim()
    .escape(),

  // Password → required for both student & institution
  body("password")
    .if(
      (value, { req }) => req.body.type === "institution"
    )
    .isStrongPassword(strongPasswordOptions)
    .withMessage(
      "Password must be at least 8 characters long and contain an uppercase letter, a lowercase letter, a number, and a symbol."
    ),

  // ✅ Contact Number → required for both student & institution
  body("contactNumber")
    .if(
      (value, { req }) =>
        req.body.type === "student" || req.body.type === "institution"
    )
    .matches(/^[0-9]{10}$/)
    .withMessage("A valid 10-digit contact number is required."),

  // ✅ Designation → required only for institution
  body("designation")
    .if((value, { req }) => req.body.type === "institution")
    .notEmpty()
    .withMessage("Designation is required for institutions.")
    .trim()
    .escape(),

  // ✅ LinkedIn URL → required only for institution
  body("linkedin")
    .if((value, { req }) => req.body.type === "institution")
    .notEmpty()
    .withMessage("LinkedIn URL is required for institutions.")
    .bail()
    .isURL()
    .withMessage("Invalid LinkedIn URL.")
    .trim(),

  handleValidationErrors,
];

const passwordRule = body("password")
  .if(body("type").equals("institution"))
  .notEmpty()
  .withMessage("Password is required for institutions.");

exports.validateLogin = [
  // ✅ Email → required only for institutions
  body("email")
    .if((value, { req }) => req.body.type === "institution")
    .notEmpty()
    .withMessage("Email is required for institutions.")
    .bail()
    .isEmail()
    .withMessage("A valid email is required.")
    .normalizeEmail(),

  // ✅ Contact Number → required only for students
  body("contactNumber")
    .if((value, { req }) => req.body.type === "student")
    .notEmpty()
    .withMessage("Contact number is required for students.")
    .bail()
    .matches(/^[0-9]{10}$/)
    .withMessage("A valid 10-digit contact number is required."),

  // ✅ Password → required for both
  passwordRule,

  handleValidationErrors,
];

// --- L1 INSTITUTION VALIDATOR ---
exports.validateL1Creation = [
  body("instituteName")
    .notEmpty()
    .withMessage("Institution name is required")
    .trim()
    .isLength({ max: 150 })
    .escape(),
  body("instituteType")
    .isIn([
      "Kindergarten/childcare center",
      "School's",
      "Intermediate college(K12)",
      "Under Graduation/Post Graduation",
      "Coaching centers",
      "Tuition Center's", // Corrected spelling
      "Study Halls",
      "Study Abroad",
    ])
    .withMessage("A valid institute type is required."),
  // body('establishmentDate').optional({ checkFalsy: true }).isISO8601().toDate().withMessage('Establishment date must be a valid date.'),
  body("approvedBy")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .escape(),
  handleValidationErrors,
];

// ✅ --- L2 BASE COURSE VALIDATOR ---
// These rules now correctly match your frontend baseCourseSchema
const l2BaseCourseRules = [
  body("courseName").trim().notEmpty().withMessage("Course name is required."),

  body("aboutCourse")
    .trim()
    .notEmpty()
    .withMessage("About course is required."),

  body("courseDuration")
    .trim()
    .notEmpty()
    .withMessage("Course duration is required."),

  body("startDate")
    .notEmpty()
    .withMessage("Course start date is required.")
    .isISO8601()
    .withMessage("Must be a valid date."),

  // ✅ ADDED: Missing endDate validation
  body("endDate")
    .notEmpty()
    .withMessage("Course end date is required.")
    .isISO8601()
    .withMessage("Must be a valid date."),

  body("mode")
    .isIn(["Offline", "Online", "Hybrid"])
    .withMessage("A valid mode is required."),

  body("priceOfCourse")
    .trim()
    .notEmpty()
    .withMessage("Price is required.")
    .withMessage("Price must be a number."),

  body("locationURL")
    .trim()
    .notEmpty()
    .withMessage("Location URL is required.")
    .matches(/^https?:\/\/.+/)
    .withMessage("Location URL must start with http:// or https://"),

  body("state").notEmpty().withMessage("State is required"),
  body("district").notEmpty().withMessage("District is required"),
  body("town").notEmpty().withMessage("Town is required"),

  body("createdBranch").optional({ checkFalsy: true }).trim(),

  // Integrated Amenities
  body("playground").optional().isIn(["Yes", "No"]).withMessage("A selection for Playground is required."),
  body("busService").optional().isIn(["Yes", "No"]).withMessage("A selection for Bus Service is required."),
  body("hostelFacility").optional().isIn(["Yes", "No"]).withMessage("A selection for Hostel Facility is required."),
  body("emioptions").optional().isIn(["Yes", "No"]).withMessage("A selection for EMI Options is required."),
  body("partlyPayment").optional().isIn(["Yes", "No"]).withMessage("A selection for Partly Payment is required."),
];

const l2SchoolRules = [
  body("schoolName").notEmpty().withMessage("School name is required."),
  body("mode").isIn(["Offline", "Online", "Hybrid"]),
  body("courseDuration").notEmpty(),
  body("startDate").optional().isISO8601(),
  body("classLanguage").notEmpty(),

  body("ownershipType").notEmpty(),
  body("schoolType").notEmpty(),
  body("curriculumType").notEmpty(),

  body("openingTime").notEmpty(),
  body("closingTime").notEmpty(),
  body("openingTimePeriod").isIn(["AM", "PM"]),
  body("closingTimePeriod").isIn(["AM", "PM"]),

  body("locationURL").notEmpty().isURL(),
  body("headquatersAddress").notEmpty(),

  body("state").notEmpty(),
  body("district").notEmpty(),
  body("town").notEmpty(),

  body("classes").isArray({ min: 1 }),
  body("classes.*.classType").notEmpty(),
  body("classes.*.priceOfCourse").isNumeric(),

  body("playground").isIn(["Yes", "No"]),
  body("pickupDropService").isIn(["Yes", "No"]),
  body("hostelFacility").isIn(["Yes", "No"]),
  body("emioptions").isIn(["Yes", "No"]),
  body("partlyPayment").isIn(["Yes", "No"]),

  body("schoolPhotoUrl").optional().isURL(),
  body("imageUrl").optional().isURL(),
  body("brochureUrl").optional().isURL()
];


const l2IntermediateCollegeRules = [
  body("intermediateName")
    .trim()
    .notEmpty()
    .withMessage("Intermediate name is required."),

  body("mode")
    .isIn(["Offline", "Online", "Hybrid"])
    .withMessage("Invalid mode specified."),

  body("courseDuration")
    .trim()
    .notEmpty()
    .withMessage("Course duration is required."),

  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be valid."),

  body("classlanguage")
    .optional()
    .trim(),

  body("ownershipType")
    .trim()
    .notEmpty()
    .withMessage("Ownership type is required."),

  body("intermediateType")
    .trim()
    .notEmpty()
    .withMessage("Intermediate type is required."),

  body("curriculumType")
    .trim()
    .notEmpty()
    .withMessage("Curriculum type is required."),

  body("operationalDays")
    .optional()
    .isArray()
    .withMessage("Operational days must be an array."),

  body("openingTime")
    .notEmpty()
    .withMessage("Opening time is required."),

  body("closingTime")
    .notEmpty()
    .withMessage("Closing time is required."),

  body("openingTimePeriod")
    .isIn(["AM", "PM"])
    .withMessage("Opening time period must be AM or PM."),

  body("closingTimePeriod")
    .isIn(["AM", "PM"])
    .withMessage("Closing time period must be AM or PM."),

  body("locationURL")
    .optional()
    .isURL()
    .withMessage("Location URL must be valid."),

  body("headquatersAddress")
    .trim()
    .notEmpty()
    .withMessage("Headquarters address is required."),

  body("state")
    .trim()
    .notEmpty()
    .isLength({ max: 100 })
    .withMessage("State is required and must be under 100 characters."),

  body("district")
    .trim()
    .notEmpty()
    .isLength({ max: 100 })
    .withMessage("District is required and must be under 100 characters."),

  body("town")
    .trim()
    .notEmpty()
    .isLength({ max: 100 })
    .withMessage("Town is required and must be under 100 characters."),

  body("year")
    .isArray({ min: 1 })
    .withMessage("At least one year entry is required."),

  body("year.*.year")
    .trim()
    .notEmpty()
    .withMessage("Year is required."),

  body("year.*.classType")
    .trim()
    .notEmpty()
    .withMessage("Class type is required."),

  body("year.*.specialization")
    .trim()
    .notEmpty()
    .withMessage("Specialization is required."),

  body("year.*.fee")
    .optional()
    .isNumeric()
    .withMessage("Fee must be a number."),

  body("playground")
    .optional()
    .isIn(["Yes", "No"])
    .withMessage("Playground must be Yes or No."),

  body("pickupDropService")
    .optional()
    .isIn(["Yes", "No"])
    .withMessage("Pickup/Drop Service must be Yes or No."),

  body("hostelFacility")
    .optional()
    .isIn(["Yes", "No"])
    .withMessage("Hostel Facility must be Yes or No."),

  body("emioptions")
    .optional()
    .isIn(["Yes", "No"])
    .withMessage("EMI options must be Yes or No."),

  body("partlyPayment")
    .optional()
    .isIn(["Yes", "No"])
    .withMessage("Partly payment must be Yes or No."),

  body("campusPhoto").optional().isURL(),
  body("imageUrl").optional().isURL(),
  body("brochureUrl").optional().isURL(),
];

const l2KindergartenRules = [
  body("categoriesType")
    .notEmpty()
    .isIn(["Nursery", "LKG", "UKG", "Playgroup"])
    .withMessage("Select valid Category Type."),

  body("courseName")
    .trim()
    .notEmpty().withMessage("Course name is required.")
    .isLength({ max: 150 }).withMessage("Course name cannot exceed 150 characters."),

  body("aboutCourse")
    .trim()
    .notEmpty().withMessage("About course is required.")
    .isLength({ max: 3000 }).withMessage("About course cannot exceed 3000 characters."),

  body("courseDuration")
    .trim()
    .notEmpty().withMessage("Course duration is required.")
    .isLength({ max: 50 }).withMessage("Course duration cannot exceed 50 characters."),

  body("mode")
    .notEmpty()
    .isIn(["Offline", "Online", "Hybrid"])
    .withMessage("Invalid mode specified."),

  body("classSize")
    .optional()
    .trim(),

  body("priceOfCourse")
    .notEmpty().withMessage("Price is required.")
    .isNumeric().withMessage("Price must be a number.")
    .custom(value => value >= 0).withMessage("Price cannot be negative."),

  body("ownershipType")
    .notEmpty()
    .isIn(["Private", "Goverment", "Trust", "Other"])
    .withMessage("Invalid ownership type selected."),

  body("locationURL")
    .trim()
    .notEmpty().withMessage("Location URL is required.")
    .isURL().withMessage("Invalid Location URL."),

  body("headquatersAddress")
    .notEmpty().withMessage("Headquarters address is required."),

  body("state")
    .trim()
    .notEmpty().withMessage("State is required.")
    .isLength({ max: 100 }),

  body("district")
    .trim()
    .notEmpty().withMessage("District is required.")
    .isLength({ max: 100 }),

  body("town")
    .trim()
    .notEmpty().withMessage("Town is required.")
    .isLength({ max: 100 }),

  body("curriculumType")
    .notEmpty().withMessage("Curriculum type is required."),

  body("openingTime")
    .optional()
    .notEmpty().withMessage("Opening time cannot be empty."),

  body("closingTime")
    .optional()
    .notEmpty().withMessage("Closing time cannot be empty."),

  body("openingTimePeriod")
    .optional()
    .isIn(["AM", "PM"])
    .withMessage("Invalid opening time period."),

  body("closingTimePeriod")
    .optional()
    .isIn(["AM", "PM"])
    .withMessage("Invalid closing time period."),

  body("operationalDays")
    .optional()
    .isArray().withMessage("Operational days must be an array."),

  body("extendedCare")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Extended Care option."),

  body("mealsProvided")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Meals Provided option."),

  body("playground")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Playground option."),

  body("pickupDropService")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Pickup/Drop Service option."),

  body("emioptions")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select EMI option."),

  body("installments")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Installments option."),

  body("teacherStudentRatio")
    .notEmpty()
    .withMessage("Teacher: Student Ratio is required."),

  body("centerImageUrl")
    .optional()
    .isURL().withMessage("Invalid Center Image URL."),

  body("kindergartenImageUrl")
    .optional()
    .isURL().withMessage("Invalid Kindergarten Image URL."),

  body("brochureUrl")
    .optional()
    .isURL().withMessage("Invalid Brochure URL."),
];

const l2UgPgCourseRules = [
  body("graduationType")
    .notEmpty()
    .isIn(["Under Graduation", "Post Graduation"])
    .withMessage("Graduation type is required."),

  body("streamType")
    .notEmpty()
    .withMessage("Stream type is required."),

  body("selectBranch")
    .notEmpty()
    .withMessage("A branch must be selected."),

  body("aboutBranch")
    .trim()
    .notEmpty()
    .withMessage("About branch is required."),

  body("educationType")
    .notEmpty()
    .isIn(["Full time", "Part time", "Distance"])
    .withMessage("A valid education type is required."),

  body("mode")
    .notEmpty()
    .isIn(["Offline", "Online", "Hybrid"])
    .withMessage("Invalid mode specified."),

  body("classSize")
    .notEmpty()
    .withMessage("Class size is required."),

  body("eligibilityCriteria")
    .trim()
    .notEmpty()
    .withMessage("Eligibility criteria is required."),

  body("ownershipType")
    .notEmpty()
    .withMessage("Ownership type is required."),

  body("collegeCategory")
    .notEmpty()
    .withMessage("College category is required."),

  body("affiliationType")
    .notEmpty()
    .withMessage("Affiliation type is required."),

  body("courseDuration")
    .trim()
    .notEmpty()
    .withMessage("Course duration is required.")
    .isLength({ max: 50 })
    .withMessage("Course duration cannot exceed 50 characters."),

  body("locationURL")
    .trim()
    .notEmpty()
    .withMessage("Location URL is required.")
    .isURL()
    .withMessage("Invalid Location URL."),

  body("headquatersAddress")
    .notEmpty()
    .withMessage("Headquarters address is required."),

  body("state")
    .trim()
    .notEmpty()
    .withMessage("State is required.")
    .isLength({ max: 100 }),

  body("district")
    .trim()
    .notEmpty()
    .withMessage("District is required.")
    .isLength({ max: 100 }),

  body("town")
    .trim()
    .notEmpty()
    .withMessage("Town is required.")
    .isLength({ max: 100 }),

  body("library")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Library option."),

  body("hostelFacility")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Hostel Facility option."),

  body("entranceExam")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Entrance Exam option."),

  body("managementQuota")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Management Quota option."),

  body("playground")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Playground option."),

  body("busService")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Bus Service option."),

  body("placementDrives")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Placement Drives option."),

  body("mockInterviews")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Mock Interviews option."),

  body("resumeBuilding")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Resume Building option."),

  body("linkedinOptimization")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select LinkedIn Optimization option."),

  body("totalNumberRequires")
    .notEmpty()
    .withMessage("Total number required is mandatory."),

  body("highestPackage")
    .optional()
    .notEmpty()
    .withMessage("Highest package cannot be empty."),

  body("averagePackage")
    .optional()
    .notEmpty()
    .withMessage("Average package cannot be empty."),

  body("totalStudentsPlaced")
    .optional()
    .notEmpty()
    .withMessage("Total students placed cannot be empty."),

  body("priceOfCourse")
    .notEmpty()
    .withMessage("Price is required.")
    .isNumeric()
    .withMessage("Price must be a number.")
    .custom(value => value >= 0)
    .withMessage("Price cannot be negative."),

  body("installments")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Installments option."),

  body("emioptions")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select EMI Options option."),

  body("centerImageUrl")
    .optional()
    .isURL()
    .withMessage("Invalid Center Image URL."),

  body("imageUrl")
    .optional()
    .isURL()
    .withMessage("Invalid Course Image URL."),

  body("brochureUrl")
    .optional()
    .isURL()
    .withMessage("Invalid Brochure URL."),
];

const l2TuitionCourseRules = [
  body("tutionCenterName")
    .trim()
    .notEmpty()
    .withMessage("Tuition centre name is required."),

  body("mode")
    .notEmpty()
    .isIn(["Offline", "Online", "Hybrid"])
    .withMessage("Invalid mode specified."),

  body("operationalDays")
    .isArray({ min: 1 })
    .withMessage("At least one operational day required."),

  body("openingTime")
    .notEmpty()
    .withMessage("Opening time is required."),

  body("closingTime")
    .notEmpty()
    .withMessage("Closing time is required."),

  body("openingTimePeriod")
    .optional()
    .isIn(["AM", "PM"])
    .withMessage("Invalid opening time period."),

  body("closingTimePeriod")
    .optional()
    .isIn(["AM", "PM"])
    .withMessage("Invalid closing time period."),

  body("subject")
    .trim()
    .notEmpty()
    .withMessage("Primary subject is required."),

  body("classSize")
    .notEmpty()
    .withMessage("Class size is required."),

  body("locationURL")
    .trim()
    .notEmpty()
    .withMessage("Location URL is required.")
    .isURL()
    .withMessage("Invalid Location URL."),

  body("headquatersAddress")
    .notEmpty()
    .withMessage("Headquarters address is required."),

  body("state")
    .trim()
    .notEmpty()
    .withMessage("State is required.")
    .isLength({ max: 100 }),

  body("district")
    .trim()
    .notEmpty()
    .withMessage("District is required.")
    .isLength({ max: 100 }),

  body("town")
    .trim()
    .notEmpty()
    .withMessage("Town is required.")
    .isLength({ max: 100 }),

  body("subjectOffer")
    .isArray({ min: 1 })
    .withMessage("At least one subject offering is required."),

  body("subjectOffer.*.subject")
    .notEmpty()
    .withMessage("Subject is required."),

  body("subjectOffer.*.classTiming")
    .notEmpty()
    .withMessage("Class timing is required."),

  body("subjectOffer.*.specialization")
    .optional(),

  body("subjectOffer.*.fee")
    .notEmpty()
    .withMessage("Fee is required.")
    .isNumeric()
    .withMessage("Fee must be a number."),

  body("faculty")
    .isArray({ min: 1 })
    .withMessage("At least one faculty detail is required."),

  body("faculty.*.facultyName")
    .notEmpty()
    .withMessage("Faculty name is required."),

  body("faculty.*.experience")
    .optional()
    .isNumeric()
    .withMessage("Experience must be a number."),

  body("faculty.*.qualifications")
    .optional(),

  body("faculty.*.subjectYouTeach")
    .optional(),

  body("partlyPayment")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Partly Payment option."),

  body("campusImage")
    .optional()
    .isURL()
    .withMessage("Invalid Campus Image URL."),

  body("imageUrl")
    .optional()
    .isURL()
    .withMessage("Invalid Course Image URL."),

  body("brochureUrl")
    .optional()
    .isURL()
    .withMessage("Invalid Brochure URL."),
];

const l2StudyAbroadRules = [
  body("listingType")
    .optional()
    .isIn(["free", "paid"])
    .withMessage("Invalid listing type."),

  body("consultancyName")
    .trim()
    .notEmpty()
    .withMessage("Consultancy name is required."),

  body("studentAdmissions")
    .notEmpty()
    .withMessage("Student admissions count is required."),

  body("locationURL")
    .trim()
    .notEmpty()
    .withMessage("Location URL is required.")
    .isURL()
    .withMessage("Invalid Location URL."),

  body("headquatersAddress")
    .notEmpty()
    .withMessage("Headquarters address is required."),

  body("state")
    .trim()
    .notEmpty()
    .withMessage("State is required.")
    .isLength({ max: 100 }),

  body("district")
    .trim()
    .notEmpty()
    .withMessage("District is required.")
    .isLength({ max: 100 }),

  body("town")
    .trim()
    .notEmpty()
    .withMessage("Town is required.")
    .isLength({ max: 100 }),

  body("countries")
    .isArray({ min: 1 })
    .withMessage("At least one country offering is required."),

  body("countries.*.country")
    .notEmpty()
    .withMessage("Country is required."),

  body("countries.*.academicOffering")
    .notEmpty()
    .withMessage("Academic offering is required."),

  body("countries.*.budget")
    .notEmpty()
    .withMessage("Budget is required.")
    .isNumeric()
    .withMessage("Budget must be a number.")
    .custom(value => value >= 0)
    .withMessage("Budget cannot be negative."),

  body("countries.*.studentSendTillNow")
    .notEmpty()
    .withMessage("Students sent count is required.")
    .isNumeric()
    .withMessage("Students sent must be a number.")
    .custom(value => value >= 0)
    .withMessage("Students sent cannot be negative."),

  body("applicationAssistance")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Application Assistance option."),

  body("visaProcessingSupport")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Visa Processing Support option."),

  body("partTimeOpportunities")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Part-time Opportunities option."),

  body("preDepartureOrientation")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Pre-departure Orientation option."),

  body("accommodationAssistance")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Accommodation Assistance option."),

  body("educationLoan")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Education Loan option."),

  body("postArrivalSupport")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Post-arrival Support option."),

  body("consultancyImageUrl")
    .optional()
    .isURL()
    .withMessage("Invalid Consultancy Image URL."),

  body("imageUrl")
    .optional()
    .isURL()
    .withMessage("Invalid Program Image URL."),

  body("brochureUrl")
    .optional()
    .isURL()
    .withMessage("Invalid Brochure URL."),

  body("businessProofUrl")
    .optional()
    .isURL()
    .withMessage("Invalid Business Proof URL."),

  body("panAadhaarUrl")
    .optional()
    .isURL()
    .withMessage("Invalid PAN/Aadhaar URL."),
];


const l2ExamPrepCourseRules = [
  body("categoriesType")
    .notEmpty()
    .withMessage("Category type is required."),

  body("domainType")
    .notEmpty()
    .withMessage("Domain type is required."),

  body("subDomainType")
    .notEmpty()
    .withMessage("Sub-domain type is required."),

  body("courseName")
    .trim()
    .notEmpty()
    .withMessage("Course name is required.")
    .isLength({ max: 150 })
    .withMessage("Course name cannot exceed 150 characters."),

  body("mode")
    .notEmpty()
    .isIn(["Offline", "Online", "Hybrid"])
    .withMessage("Invalid mode specified."),

  body("courseDuration")
    .trim()
    .notEmpty()
    .withMessage("Course duration is required.")
    .isLength({ max: 50 })
    .withMessage("Course duration cannot exceed 50 characters."),

  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date."),

  body("classlanguage")
    .notEmpty()
    .withMessage("Class language is required."),

  body("classSize")
    .notEmpty()
    .withMessage("Class size is required."),

  body("mockTests")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Mock Tests option."),

  body("locationURL")
    .trim()
    .notEmpty()
    .withMessage("Location URL is required.")
    .isURL()
    .withMessage("Invalid Location URL."),

  body("headquatersAddress")
    .notEmpty()
    .withMessage("Headquarters address is required."),

  body("state")
    .trim()
    .notEmpty()
    .withMessage("State is required.")
    .isLength({ max: 100 }),

  body("district")
    .trim()
    .notEmpty()
    .withMessage("District is required.")
    .isLength({ max: 100 }),

  body("town")
    .trim()
    .notEmpty()
    .withMessage("Town is required.")
    .isLength({ max: 100 }),

  body("priceOfCourse")
    .notEmpty()
    .withMessage("Price is required.")
    .isNumeric()
    .withMessage("Price must be a number.")
    .custom(value => value >= 0)
    .withMessage("Price cannot be negative."),

  body("installments")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Installments option."),

  body("emioptions")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select EMI option."),

  body("libraryFacility")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Library Facility option."),

  body("studyMaterial")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Study Material option."),

  body("centerImageUrl")
    .optional()
    .isURL()
    .withMessage("Invalid Center Image URL."),

  body("imageUrl")
    .optional()
    .isURL()
    .withMessage("Invalid Course Image URL."),

  body("brochureUrl")
    .optional()
    .isURL()
    .withMessage("Invalid Brochure URL."),
];


const l2UpskillingCourseRules = [

  body("categoriesType")
    .notEmpty()
    .withMessage("Category type is required."),

  body("domainType")
    .notEmpty()
    .withMessage("Domain type is required."),

  body("subDomainType")
    .notEmpty()
    .withMessage("Sub-domain type is required."),

  body("courseName")
    .trim()
    .notEmpty()
    .withMessage("Course name is required.")
    .isLength({ max: 150 })
    .withMessage("Course name cannot exceed 150 characters."),

  body("mode")
    .notEmpty()
    .isIn(["Offline", "Online", "Hybrid"])
    .withMessage("Invalid mode specified."),

  body("courseDuration")
    .trim()
    .notEmpty()
    .withMessage("Course duration is required.")
    .isLength({ max: 50 })
    .withMessage("Course duration cannot exceed 50 characters."),

  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date."),

  body("classTiming")
    .notEmpty()
    .withMessage("Class timing is required."),

  body("courselanguage")
    .notEmpty()
    .withMessage("Course language is required."),

  body("certification")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Certification option."),

  body("locationURL")
    .trim()
    .notEmpty()
    .withMessage("Location URL is required.")
    .isURL()
    .withMessage("Invalid Location URL."),

  body("headquatersAddress")
    .notEmpty()
    .withMessage("Headquarters address is required."),

  body("state")
    .trim()
    .notEmpty()
    .withMessage("State is required.")
    .isLength({ max: 100 }),

  body("district")
    .trim()
    .notEmpty()
    .withMessage("District is required.")
    .isLength({ max: 100 }),

  body("town")
    .trim()
    .notEmpty()
    .withMessage("Town is required.")
    .isLength({ max: 100 }),

  body("placementDrives")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Placement Drives option."),

  body("totalNumberRequires")
    .optional()
    .notEmpty()
    .withMessage("Total number required cannot be empty."),

  body("highestPackage")
    .optional()
    .notEmpty()
    .withMessage("Highest package cannot be empty."),

  body("averagePackage")
    .optional()
    .notEmpty()
    .withMessage("Average package cannot be empty."),

  body("totalStudentsPlaced")
    .optional()
    .notEmpty()
    .withMessage("Total students placed cannot be empty."),

  body("mockInterviews")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Mock Interviews option."),

  body("resumeBuilding")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Resume Building option."),

  body("linkedinOptimization")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select LinkedIn Optimization option."),

  body("priceOfCourse")
    .notEmpty()
    .withMessage("Price is required.")
    .isNumeric()
    .withMessage("Price must be a number.")
    .custom(value => value >= 0)
    .withMessage("Price cannot be negative."),

  body("installments")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select Installments option."),

  body("emioptions")
    .notEmpty()
    .isIn(["Yes", "No"])
    .withMessage("Select EMI option."),

  body("centerImageUrl")
    .optional()
    .isURL()
    .withMessage("Invalid Center Image URL."),

  body("imageUrl")
    .optional()
    .isURL()
    .withMessage("Invalid Course Image URL."),

  body("brochureUrl")
    .optional()
    .isURL()
    .withMessage("Invalid Brochure URL."),
];

// Define this at the top of your validator file
const BLUE_BOX_FIELDS = {
  "Intermediate college(K12)": ["year", "classType", "specialization", "priceOfCourse"],
  "School's": ["classType", "priceOfCourse"],
  "Kindergarten/childcare center": ["categoriesType", "priceOfCourse"],
  "Study Abroad": ["countriesOffered", "academicOfferings", "budget", "studentsSent"],
  "Tution Center's": ["academicDetails", "facultyDetails"],
  "Under Graduation/Post Graduation": ["graduationType", "streamType", "selectBranch", "branchDescription", "educationType", "priceOfCourse"]
};

// exports.validateL2Update = async (req, res, next) => {
//   try {

//     const { institutionType } = req.body;

//     if (!institutionType) {
//       return res.status(400).json({
//         message: "institutionType is required",
//       });
//     }

//     const validationMap = {
//       SCHOOL: l2SchoolRules,
//       INTERMEDIATE: l2IntermediateCollegeRules,
//       UG_PG: l2UgPgCourseRules,
//       KINDERGARTEN: l2KindergartenRules,
//       TUTION: l2TuitionCourseRules,
//       STUDY_ABROAD: l2StudyAbroadRules,
//       EXAM_PREP: l2ExamPrepCourseRules,
//       UPSKILLING: l2UpskillingCourseRules,
//     };

//     const validationChain = validationMap[institutionType];

//     if (!validationChain) {
//       return res.status(400).json({
//         message: `Unsupported institutionType: ${institutionType}`,
//       });
//     }

//     await Promise.all(validationChain.map(v => v.run(req)));

//     return handleValidationErrors(req, res, next);

//   } catch (error) {
//     next(error);
//   }
// };


exports.validateL2Update = async (req, res, next) => {
  try {
    const { institutionType, courses } = req.body;

    if (!institutionType) {
      return res.status(400).json({
        message: "institutionType is required",
      });
    }

    const validationMap = {
      SCHOOL: l2SchoolRules,
      INTERMEDIATE: l2IntermediateCollegeRules,
      UG_PG: l2UgPgCourseRules,
      KINDERGARTEN: l2KindergartenRules,
      KINDERGARTEN: l2KindergartenRules,
      TUTION_CENTER: l2TuitionCourseRules,
      STUDY_ABROAD: l2StudyAbroadRules,
      STUDY_ABROAD: l2StudyAbroadRules,
      EXAM_PREP: l2ExamPrepCourseRules,
      UPSKILLING: l2UpskillingCourseRules,
    };

    const validationChain = validationMap[institutionType];

    if (!validationChain) {
      return res.status(400).json({
        message: `Unsupported institutionType: ${institutionType}`,
      });
    }

    // ✅ If courses array is sent, validate each item separately
    if (Array.isArray(courses)) {
      for (let i = 0; i < courses.length; i++) {
        const originalBody = req.body;

        // Replace body with current course object
        req.body = { ...courses[i] };

        await Promise.all(validationChain.map(v => v.run(req)));

        // Restore original body
        req.body = originalBody;
      }
    } else {
      // Normal single object validation
      await Promise.all(validationChain.map(v => v.run(req)));
    }

    return handleValidationErrors(req, res, next);

  } catch (error) {
    next(error);
  }
};


// --- BRANCH VALIDATORS ---
exports.validateBranchCreation = [
  param("institutionId").isMongoId().withMessage("Invalid institution ID."),
  body("branchName")
    .trim()
    .notEmpty()
    .withMessage("Branch name is required.")
    .isLength({ max: 100 }),
  body("contactInfo.countryCode").optional().trim(),
  body("contactInfo.number")
    .trim()
    .notEmpty()
    .matches(/^\d{10}$/)
    .withMessage("A valid 10-digit contact number is required."),
  body("branchAddress")
    .trim()
    .notEmpty()
    .withMessage("Branch address is required.")
    .isLength({ max: 255 }),
  body("locationUrl").optional({ checkFalsy: true }),
  // .isURL()
  // .withMessage("Must be a valid URL."),
  handleValidationErrors,
];

exports.validateBranchUpdate = [
  param("institutionId").isMongoId().withMessage("Invalid institution ID."),
  param("branchId").isMongoId().withMessage("Invalid branch ID."),
  body("branchName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Branch name cannot be empty.")
    .isLength({ max: 100 }),
  body("contactInfo.number")
    .optional()
    .trim()
    .notEmpty()
    .matches(/^\d{10}$/)
    .withMessage("A valid 10-digit contact number is required."),
  body("branchAddress")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Branch address cannot be empty.")
    .isLength({ max: 255 }),
  body("locationUrl").optional({ checkFalsy: true }),
  // .isURL()
  // .withMessage("Must be a valid URL."),
  handleValidationErrors,
];

// --- COURSE VALIDATORS---
exports.validateCourseCreation = [
  param("institutionId").isMongoId().withMessage("Invalid institution ID."),

  body("courseName")
    .trim()
    .notEmpty()
    .withMessage("Course name is required.")
    .isLength({ max: 150 }),

  body("aboutCourse")
    .trim()
    .notEmpty()
    .withMessage("About course is required.")
    .isLength({ max: 2000 }),

  body("courseDuration")
    .trim()
    .notEmpty()
    .withMessage("Course duration is required.")
    .isLength({ max: 50 }), // Now allows "4 Years"

  body("mode")
    .isIn(["Offline", "Online", "Hybrid"])
    .withMessage("Invalid mode specified."),

  body("priceOfCourse")
    .notEmpty()
    .withMessage("Price is required."),
  // Removed .isNumeric() because frontend sends it as a string "100000"

  // UPDATED: Changed from 'location' to 'locationURL' to match your frontend payload
  body("locationURL")
    .trim()
    .notEmpty()
    .withMessage("Location URL is required."),

  body("imageUrl")
    .trim()
    .isURL()
    .withMessage("Image URL must be a valid S3 URL."),

  // UPDATED: Fixed the spelling from 'brotureUrl' to 'brochureUrl'
  body("brochureUrl")
    .trim()
    .isURL()
    .withMessage("Brochure URL must be a valid S3 URL."),

  // NEW: Added these fields since they appear in your frontend network tab
  body("graduationType").optional().trim(),
  body("streamType").optional().trim(),
  body("selectBranch").optional().trim(),
  body("highestPackage").optional().trim(),
  body("averagePackage").optional().trim(),

  handleValidationErrors,
];

exports.validateCourseUpdate = [
  param("institutionId").isMongoId().withMessage("Invalid institution ID."),
  param("courseId").isMongoId().withMessage("Invalid course ID."),
  body("courseName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Course name cannot be empty")
    .isLength({ max: 150 }),
  body("aboutCourse")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("About course cannot be empty")
    .isLength({ max: 2000 }),
  handleValidationErrors,
];


// --- L1 INSTITUTION VALIDATOR ---
exports.validateL1Creation = [
  // --- Institute Type ---
  body("instituteType")
    .isIn([
      "Kindergarten/childcare center",
      "School's",
      "Intermediate college(K12)",
      "Under Graduation/Post Graduation",
      "Coaching centers",
      "Tution Center's",
      "Study Halls",
      "Study Abroad",
      "Exam Preparation",
      "Upskilling",
    ])
    .withMessage("A valid institute type is required."),

  // --- Institute Name ---
  body("instituteName")
    .notEmpty()
    .withMessage("Institute Name is required")
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage("Institute Name must be between 3 and 100 characters")
    .matches(/^[A-Za-z][A-Za-z\s.&'-]*$/)
    .withMessage(
      "Institute Name must start with a letter and can only contain letters, numbers, spaces, . & ' -"
    )
    .escape(),

  // --- Conditional Validation for Approved By ---
  body("approvedBy")
    .if(body("instituteType").not().isIn(["Study Halls", "Study Abroad"])) // Skip for Study Halls and Study Abroad
    .notEmpty()
    .withMessage("Approved By is required")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Approved By must be between 2 and 100 characters")
    .matches(/^[A-Za-z][A-Za-z\s.&'-]*$/)
    .withMessage(
      "Approved By must start with a letter and can only contain letters, spaces, . & ' -"
    )
    .escape(),

  // --- Conditional Validation for Establishment Date ---
  body("establishmentDate")
    .if(body("instituteType").not().isIn(["Study Halls", "Study Abroad"])) // Skip for Study Halls and Study Abroad
    .notEmpty()
    .withMessage("Establishment Date is required")
    .isISO8601()
    .withMessage("Must be a valid date")
    .custom((value) => {
      const enteredDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (enteredDate > today) {
        throw new Error("Establishment Date cannot be in the future");
      }
      return true; // Indicates validation passed
    }),

  // --- Contact Info (Required) ---
  body("contactInfo")
    .notEmpty()
    .withMessage("Contact info is required")
    .isLength({ min: 10, max: 10 })
    .withMessage("Contact number must be exactly 10 digits")
    .isNumeric()
    .withMessage("Contact number must only contain digits"),

  // --- Additional Contact Info (Optional) ---
  body("additionalContactInfo")
    .optional({ checkFalsy: true }) // Makes the field optional
    .isLength({ min: 10, max: 10 })
    .withMessage("Additional contact must be 10 digits if provided")
    .isNumeric()
    .withMessage("Additional contact must only contain digits"),

  // --- Address Details ---
  body("headquartersAddress")
    .notEmpty()
    .withMessage("Headquarters Address is required"),

  body("state")
    .notEmpty()
    .withMessage("State is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("State must be between 2 and 50 characters")
    .matches(/^[A-Za-z][A-Za-z\s]*$/)
    .withMessage("State name should only include alphabets and spaces"),

  body("pincode")
    .notEmpty()
    .withMessage("Pincode is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("Pincode must be exactly 6 digits")
    .isNumeric()
    .withMessage("Pincode must only contain digits"),

  // --- Location URL ---
  body("locationURL").notEmpty().withMessage("Location URL is required"),
  // .isURL()
  // .withMessage("Please enter a valid URL"),

  // --- Conditional Validation for Logo URL ---
  body("logoUrl")
    .optional({ checkFalsy: true })
    .if(body("instituteType").not().equals("Study Abroad")) // Skip for Study Abroad
    .trim()
    .isURL()
    .withMessage("Logo URL must be a valid URL."),

  handleValidationErrors, // Your existing error handler
];

// --- L2 BRANCH & COURSE VALIDATORS (For File Upload) ---

const l2BranchRules = [
  // Allow branchName to be an empty string (for the unassigned courses object),
  // but validate its length if it does exist.
  body("*.branchName")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage("Branch name must be between 3 and 100 characters."),

  // These fields are now ONLY required IF a branchName is provided.
  body("*.branchAddress")
    .if(body("*.branchName").notEmpty()) // The condition
    .trim()
    .notEmpty()
    .withMessage("Branch address is required when a branch name is provided."),

  body("*.contactInfo")
    .if(body("*.branchName").notEmpty()) // The condition
    .trim()
    .notEmpty()
    .withMessage("Contact info is required when a branch name is provided.")
    .matches(/^[0-9]{10}$/)
    .withMessage("A valid 10-digit contact number is required."),

  body("*.locationURL")
    .if(body("*.branchName").notEmpty()) // The condition
    .trim()
    .notEmpty()
    .withMessage("Location URL is required when a branch name is provided."),
  // .isURL()
  // .withMessage("Must be a valid URL."),
];



exports.validateUploadedFile = async (req, res, next) => {
  console.log("\n--- 🚀 [START] Bulk File Validation ---");

  if (!req.file) {
    return res.status(400).json({ message: "No file was uploaded." });
  }

  try {
    const fileContent = req.file.buffer.toString("utf8");
    const jsonData = JSON.parse(fileContent);

    if (!jsonData.institution || !jsonData.courses) {
      return res.status(400).json({
        message: "File must contain 'institution' and 'courses' properties.",
      });
    }

    const { institution, courses } = jsonData;
    const type = institution.instituteType;

    // 1. Determine the validation chain based on type
    let courseValidationChain = [];
    switch (type) {
      case "Kindergarten/childcare center":
        courseValidationChain = l2KindergartenRules;
        break;
      case "School's":
        courseValidationChain = l2SchoolRules;
        break;
      case "Intermediate college(K12)":
        courseValidationChain = l2IntermediateCollegeRules;
        break;
      case "Under Graduation/Post Graduation":
        courseValidationChain = l2UgPgCourseRules;
        break;
      case "Coaching centers":
        courseValidationChain = l2CoachingCourseRules;
        break;
      case "Tution Center's":
        courseValidationChain = l2TuitionCourseRules;
        break;
      case "Study Halls":
        courseValidationChain = l2StudyHallRules;
        break;
      case "Study Abroad":
        courseValidationChain = l2StudyAbroadRules;
        break;
      default:
        return res.status(400).json({ message: `Unsupported type: ${type}` });
    }

    // 

    // 2. Loop through each branch and each course
    for (const branchGroup of courses) {
      // Validate the branch structure itself
      req.body = branchGroup;
      await Promise.all(l2BranchRules.map((v) => v.run(req)));
      let branchErrors = validationResult(req);

      if (!branchErrors.isEmpty()) {
        return res.status(422).json({
          context: "Branch Data Error",
          branch: branchGroup.branchName,
          errors: branchErrors.array(),
        });
      }

      // 3. Validate every course within this branch
      for (const course of branchGroup.courses || []) {
        // We set req.body to the current course so express-validator can "see" it
        req.body = course;

        await Promise.all(courseValidationChain.map((v) => v.run(req)));
        let courseErrors = validationResult(req);

        if (!courseErrors.isEmpty()) {
          // Dynamic name lookup for the error response
          const cName = course.courseName || course.hallName || course.consultancyName || "Unnamed";

          console.error(`❌ FAILED: ${cName} in branch ${branchGroup.branchName}`);
          return res.status(422).json({
            context: "Course Data Error",
            branch: branchGroup.branchName,
            course: cName,
            errors: courseErrors.array(),
          });
        }
      }
    }

    console.log("✅ SUCCESS: All branches and courses passed validation.");
    req.institutionData = institution;
    req.coursesData = courses;
    next();

  } catch (error) {
    logger.error({ error: error.message }, "Critical File Validation Error");
    return res.status(400).json({ message: "Invalid JSON format or structure." });
  }
};

// 1. Updated Whitelist (Fixed typos and added missing fields from L2)
const allowedFilters = new Set([
  "page", "limit", "state", "pincode", "instituteType", "district", "town",
  "playground", "busService", "hostelFacility", "extendedCare", "mealsProvided",
  "outdoorPlayArea", "placementDrives", "mockInterviews", "resumeBuilding",
  "linkedinOptimization", "certification", "library", "entranceExam",
  "managementQuota", "emioptions", "partlyPayment"
]);

exports.validateInstitutionFilter = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),

  query("state").optional().isString().trim(),
  query("instituteType")
    .optional()
    .isIn([
      "Kindergarten/childcare center",
      "School's",
      "Intermediate college(K12)",
      "Under Graduation/Post Graduation",
      "Coaching centers",
      "Tuition Center's", // Fixed spelling
      "Study Halls",
      "Study Abroad",
    ]),

  // Updated Amenity Validation: Match the "Yes"/"No" logic used in L2 rules
  [
    "playground", "busService", "hostelFacility", "extendedCare",
    "mealsProvided", "outdoorPlayArea", "placementDrives", "mockInterviews",
    "resumeBuilding", "linkedinOptimization", "certification", "library",
    "entranceExam", "managementQuota", "emioptions", "partlyPayment"
  ].map(field =>
    query(field)
      .optional()
      .isIn(["Yes", "No"])
      .withMessage(`${field} must be either 'Yes' or 'No'.`)
  ),

  // 3. Strict Whitelist Check
  query().custom((value, { req }) => {
    for (const param in req.query) {
      if (!allowedFilters.has(param)) {
        throw new Error(`Unknown filter parameter: '${param}'.`);
      }
    }
    return true;
  }),

  handleValidationErrors,
];

// =======================
// --- L2 COURSE RULES ---
// =======================
module.exports.l2BaseCourseRules = l2BaseCourseRules;
module.exports.l2UgPgCourseRules = l2UgPgCourseRules;
// module.exports.l2CoachingCourseRules = l2CoachingCourseRules;
module.exports.l2TuitionCourseRules = l2TuitionCourseRules;
// module.exports.l2StudyHallRules = l2StudyHallRules;
module.exports.l2StudyAbroadRules = l2StudyAbroadRules;
module.exports.l2SchoolRules = l2SchoolRules;
module.exports.l2IntermediateCollegeRules = l2IntermediateCollegeRules;
module.exports.l2KindergartenRules = l2KindergartenRules;

// Export the validation error handler
module.exports.handleValidationErrors = handleValidationErrors;
module.exports.validateInstitutionFilter = this.validateInstitutionFilter;
