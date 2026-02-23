const mongoose = require("mongoose");
const { Client } = require('@elastic/elasticsearch');
const esClient = new Client({ node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200' });

const courseSchema = new mongoose.Schema(
  {
    // --- 1. SYSTEM & RELATIONSHIP FIELDS ---
    parentProgram: { type: mongoose.Schema.Types.ObjectId, ref: "Course", index: true },
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
    type: {
      type: String,
      enum: ["COURSE", "PROGRAM"],
      default: "COURSE"
    },
    courseType: { type: String }, // Stores category like "Coaching centers", "Study Abroad", etc.
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Inactive'
    },
    courseSubscriptionStartDate: { type: Date },
    courseSubscriptionEndDate: { type: Date },


    listingType: {
      type: String,
      enum: ['free', 'paid'],
      default: 'paid'
    },
    // Location A: The specific campus/town where the course is held
    state: { type: String, trim: true, maxlength: 100 },
    district: { type: String, trim: true, maxlength: 100 },
    town: { type: String, trim: true, maxlength: 100 },
    locationURL: { type: String, trim: true }, // Map Link for this specific campus

    //Institutional Headquarters / Main Branch Address
    aboutBranch: { type: String, trim: true },

    // Track if Location A is synced from Location B ("Main")
    createdBranch: { type: String },


    // --- 3. COMMON CORE FIELDS ---
    courseName: { type: String, trim: true, maxlength: 150 },
    aboutCourse: { type: String, trim: true, maxlength: 3000 },
    courseDuration: { type: String, trim: true, maxlength: 50 },
    startDate: { type: Date },
    endDate: { type: Date },
    mode: { type: String, enum: ["Offline", "Online", "Hybrid"] },
    priceOfCourse: { type: Number, min: 0 },

    // --- 4. CONSOLIDATED MEDIA (S3 URLS) ---
    imageUrl: { type: String },
    brochureUrl: { type: String },
    intermediateImageUrl: { type: String },
    schoolImageUrl: { type: String },
    kindergartenImageUrl: { type: String },
    centerImageUrl: { type: String },
    consultancyImageUrl: { type: String },
    collegeImageUrl: { type: String },
    tuitionImageUrl: { type: String },
    businessProofUrl: { type: String },
    panAadhaarUrl: { type: String },

    // --- 5. INSTITUTIONAL & ACADEMIC META (Schools, Colleges, K12) ---
    collegeType: { type: String },
    schoolType: { type: String },
    curriculumType: { type: String },
    streamType: { type: String },
    selectBranch: { type: String },
    year: { type: String },
    specialization: { type: String },
    classType: { type: String },
    ownershipType: { type: String },
    affiliationType: { type: String },
    educationType: { type: String },
    eligibilityCriteria: { type: String },
    classSize: { type: String },
    classSizeRatio: { type: String },

    // --- 6. COACHING & SKILLING SPECIFIC ---
    categoriesType: { type: String },
    domainType: { type: String },
    subDomainType: { type: String },
    courseHighlights: { type: String },
    classTiming: { type: String },
    courselanguage: { type: String },
    classlanguage: { type: String },

    // --- 7. STUDY HALL & OPERATIONAL TIMES ---
    hallName: { type: String, trim: true },
    seatingOption: { type: String },
    openingTime: { type: String },
    closingTime: { type: String },
    openingTimePeriod: { type: String, enum: ["AM", "PM"] },
    closingTimePeriod: { type: String, enum: ["AM", "PM"] },
    operationalDays: [{ type: String }],
    totalSeats: { type: String },
    availableSeats: { type: String },
    pricePerSeat: { type: String },

    // --- 8. STUDY ABROAD CORE ---
    consultancyName: { type: String },
    studentAdmissions: { type: String },
    countriesOffered: { type: String },
    academicOfferings: { type: String },
    budget: { type: String },
    studentsSent: { type: String },
    courseType: { type: String },

    // --- 9. YES/NO FACILITIES & CAREER (Strings to match Frontend) ---
    placementDrives: { type: String, enum: ["Yes", "No"] },
    totalStudentsPlaced: { type: String },
    highestPackage: { type: String },
    averagePackage: { type: String },
    mockInterviews: { type: String, enum: ["Yes", "No"] },
    resumeBuilding: { type: String, enum: ["Yes", "No"] },
    linkedinOptimization: { type: String, enum: ["Yes", "No"] },
    mockTests: { type: String, enum: ["Yes", "No"] },
    certification: { type: String, enum: ["Yes", "No"] },
    studyMaterial: { type: String, enum: ["Yes", "No"] },
    library: { type: String, enum: ["Yes", "No"] },
    libraryFacility: { type: String, enum: ["Yes", "No"] },
    entranceExam: { type: String, enum: ["Yes", "No"] },
    managementQuota: { type: String, enum: ["Yes", "No"] },
    totalNumberRequires: { type: String },
    extendedCare: { type: String, enum: ["Yes", "No"] },
    mealsProvided: { type: String, enum: ["Yes", "No"] },
    playground: { type: String, enum: ["Yes", "No"] },
    busService: { type: String, enum: ["Yes", "No"] },
    hostelFacility: { type: String, enum: ["Yes", "No"] },
    hasWifi: { type: String, enum: ["Yes", "No"] },
    hasChargingPoints: { type: String, enum: ["Yes", "No"] },
    hasAC: { type: String, enum: ["Yes", "No"] },
    hasPersonalLocker: { type: String, enum: ["Yes", "No"] },
    emioptions: { type: String, enum: ["Yes", "No"] },
    installments: { type: String, enum: ["Yes", "No"] },
    partlyPayment: { type: String, enum: ["Yes", "No"] },
    partTimeHelp: { type: String, enum: ["Yes", "No"] },

    //  TUITION CENTER NESTED LISTS ---
    subject: { type: String },
    tuitionType: { type: String },
    instructorProfile: { type: String },
    academicDetails: [{
      subject: String,
      classTiming: String,
      specialization: String,
      monthlyFees: String
    }],
    facultyDetails: [{
      name: String,
      qualification: String,
      experience: String,
      subjectTeach: String
    }],

    // --- 11. SUBSCRIPTION VARIATIONS ARRAY ---
    courses: [
      {
        type: mongoose.Schema.Types.Mixed,
      }
    ],
  },
  { timestamps: true }
);

const Course = mongoose.model("Course", courseSchema);


// --- HELPER FUNCTION ---
const prepareESDocument = (doc) => {
  return {
    id: doc._id.toString(),
    courseName: doc.courseName || null,
    selectBranch: doc.selectBranch || null,
    status: doc.status
  };
};

// --- POST SAVE ---
courseSchema.post('save', async function (doc) {
  try {
    if (doc.status === 'Active') {
      await esClient.index({
        index: 'courses_index',
        id: doc._id.toString(),
        document: prepareESDocument(doc), // Uses Helper
      });
      console.log(`✅ ES Index: ${doc._id}`);
    } else {
      await esClient.delete({
        index: 'courses_index',
        id: doc._id.toString(),
      }).catch(() => { });
      console.log(`🗑️ Removed inactive course ${doc._id} from Elasticsearch`);
    }
  } catch (err) {
    console.error('❌ ES Save Error:', err.message);
  }
});

// --- POST UPDATE ---
courseSchema.post('findOneAndUpdate', async function (doc) {
  try {
    if (!doc) return;
    if (doc.status === 'Active') {
      await esClient.index({
        index: 'courses_index',
        id: doc._id.toString(),
        document: prepareESDocument(doc), // Uses Helper
      });
      console.log(`🔁 ES Update: ${doc._id}`);
    } else {
      await esClient.delete({
        index: 'courses_index',
        id: doc._id.toString(),
      }).catch(() => { });
      console.log(`🗑️ Removed inactive course ${doc._id} from Elasticsearch`);
    }
  } catch (err) {
    console.error('❌ ES Update Error:', err.message);
  }
});

// --- POST DELETE ---
courseSchema.post('findOneAndDelete', async function (doc) {
  try {
    if (doc) {
      await esClient.delete({
        index: 'courses_index',
        id: doc._id.toString(),
      });
      console.log(`🗑️ ES Delete: ${doc._id}`);
    }
  } catch (err) {
    console.error('❌ ES Delete Error:', err.message);
  }
});

module.exports = Course;
