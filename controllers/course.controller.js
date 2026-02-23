const Course = require("../models/Course");
const { Institution } = require("../models/Institution");
const InstituteAdminModel = require("../models/InstituteAdmin");
const AppError = require("../utils/appError");
const asyncHandler = require("express-async-handler");
const RedisUtil = require("../utils/redis.util");
const mongoose = require("mongoose");
const { esClient } = require("../config/elasticsearch");
const ObjectId = mongoose.Types.ObjectId;
const redisClient = require("../config/redisConfig");
const COURSE_MODEL_MAP = require("../utils/CourseMap");
// Generic helpers
async function incrementMetricGeneric(req, res, next, cfg) {
  const { institutionId, courseId } = req.params;
  const { metricField, rollupField, updatedEvent, institutionAdminTotalEvent } =
    cfg;

  const incUpdate = {};
  incUpdate[metricField] = 1;
  const course = await Course.findOneAndUpdate(
    { _id: courseId, institution: institutionId },
    { $inc: incUpdate },
    { new: true },
  );
  if (!course) return next(new AppError("Course not found", 404));

  // rollup upsert for today
  try {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    const dayKey = `${yyyy}-${mm}-${dd}`;

    const incPath = `${rollupField}.$.count`;
    const queryHas = { _id: courseId };
    queryHas[`${rollupField}.day`] = dayKey;
    const queryPush = { _id: courseId };
    queryPush[`${rollupField}.day`] = { $ne: dayKey };

    await Course.updateOne(queryHas, { $inc: { [incPath]: 1 } });
    await Course.updateOne(queryPush, {
      $push: { [rollupField]: { day: dayKey, count: 1 } },
    });
  } catch (err) {
    console.error(
      "CourseController: rollup update failed",
      err?.message || err,
    );
  }

  // Emit socket events with fresh institutionAdmin total
  try {
    const io = req.app.get("io");
    if (io) {
      const payload = { institutionId, courseId };
      payload[metricField] = course[metricField];
      io.to(`institution:${institutionId}`).emit(updatedEvent, payload);

      const inst =
        await Institution.findById(institutionId).select("institutionAdmin");
      if (inst?.institutionAdmin) {
        const adminId = String(inst.institutionAdmin);
        io.to(`institutionAdmin:${adminId}`).emit(updatedEvent, payload);
        const institutions = await Institution.find({
          institutionAdmin: adminId,
        }).select("_id");
        const ids = institutions.map((i) => i._id);
        if (ids.length > 0) {
          const groupField = {};
          groupField[`total`] = { $sum: { $ifNull: [`$${metricField}`, 0] } };
          const agg = await Course.aggregate([
            { $match: { institution: { $in: ids } } },
            { $group: Object.assign({ _id: null }, groupField) },
          ]);
          const total = agg[0]?.total || 0;
          const totalPayload =
            metricField === "courseViews"
              ? { totalViews: total }
              : metricField === "comparisons"
                ? { totalComparisons: total }
                : { totalLeads: total };
          io.to(`institutionAdmin:${adminId}`).emit(
            institutionAdminTotalEvent,
            totalPayload,
          );
        }
      }
    }
  } catch (err) {
    console.error(
      "CourseController: socket emit/institutionAdmin total failed",
      err?.message || err,
    );
  }

  return res.status(200).json({
    success: true,
    data: { courseId, [metricField]: course[metricField] },
  });
}

async function institutionAdminTotalGeneric(userId, metricField) {
  const institutions = await Institution.find({
    institutionAdmin: userId,
  }).select("_id");
  const ids = institutions.map((i) => i._id);
  if (ids.length === 0) return 0;
  const agg = await Course.aggregate([
    { $match: { institution: { $in: ids } } },
    {
      $group: {
        _id: null,
        total: { $sum: { $ifNull: [`$${metricField}`, 0] } },
      },
    },
  ]);
  return agg[0]?.total || 0;
}

// student-based leads helpers
async function institutionAdminLeadsRangeCurrent(userId, range) {
  const institutions = await Institution.find({
    institutionAdmin: userId,
  }).select("_id");
  const ids = institutions.map((i) => i._id);
  if (ids.length === 0) return 0;
  const now = new Date();
  let startDate, endDate;
  if (range === "weekly") {
    startDate = new Date(now);
    startDate.setUTCDate(startDate.getUTCDate() - 6);
    endDate = new Date(now);
  } else if (range === "monthly") {
    startDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
    endDate = new Date(now);
  } else if (range === "yearly") {
    startDate = new Date(now.getUTCFullYear(), 0, 1);
    endDate = new Date(now);
  } else {
    return 0;
  }
  return InstituteAdminModel.countDocuments({
    institution: { $in: ids },
    role: "STUDENT",
    createdAt: { $gte: startDate, $lte: endDate },
  });
}

async function institutionAdminLeadsRangePrevious(userId, range) {
  const institutions = await Institution.find({
    institutionAdmin: userId,
  }).select("_id");
  const ids = institutions.map((i) => i._id);
  if (ids.length === 0) return 0;
  const now = new Date();
  let startDate, endDate;
  if (range === "weekly") {
    endDate = new Date(now);
    endDate.setUTCDate(endDate.getUTCDate() - 7);
    startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - 6);
  } else if (range === "monthly") {
    startDate = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
    endDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
  } else if (range === "yearly") {
    startDate = new Date(now.getUTCFullYear() - 1, 0, 1);
    endDate = new Date(now.getUTCFullYear(), 0, 1);
  } else {
    return 0;
  }
  return InstituteAdminModel.countDocuments({
    institution: { $in: ids },
    role: "STUDENT",
    createdAt: { $gte: startDate, $lt: endDate },
  });
}

// Fixed range calculation function with proper date handling
async function institutionAdminRangeGeneric(userId, rollupField, range) {
  const institutions = await Institution.find({
    institutionAdmin: userId,
  }).select("_id");
  const ids = institutions.map((i) => i._id);
  if (ids.length === 0) return 0;

  const now = new Date();
  let startDate, endDate;

  if (range === "weekly") {
    // Last 7 days (including today)
    startDate = new Date(now);
    startDate.setUTCDate(startDate.getUTCDate() - 6);
    endDate = new Date(now);
  } else if (range === "monthly") {
    // Current month (from 1st to today)
    startDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
    endDate = new Date(now);
  } else if (range === "yearly") {
    // Current year (from Jan 1st to today)
    startDate = new Date(now.getUTCFullYear(), 0, 1);
    endDate = new Date(now);
  } else {
    return 0;
  }

  // Format dates for comparison (YYYY-MM-DD format)
  const startKey = startDate.toISOString().split("T")[0];
  const endKey = endDate.toISOString().split("T")[0];

  const agg = await Course.aggregate([
    { $match: { institution: { $in: ids } } },
    { $unwind: { path: `$${rollupField}`, preserveNullAndEmptyArrays: false } },
    {
      $match: {
        [`${rollupField}.day`]: {
          $gte: startKey,
          $lte: endKey,
        },
      },
    },
    { $group: { _id: null, total: { $sum: `$${rollupField}.count` } } },
  ]);

  return agg[0]?.total || 0;
}

// Fixed previous range calculation function with proper date handling
async function institutionAdminPreviousRangeGeneric(
  userId,
  rollupField,
  range,
) {
  const institutions = await Institution.find({
    institutionAdmin: userId,
  }).select("_id");
  const ids = institutions.map((i) => i._id);
  if (ids.length === 0) return 0;

  const now = new Date();
  let startDate, endDate;

  if (range === "weekly") {
    // Previous week (7 days before current week)
    endDate = new Date(now);
    endDate.setUTCDate(endDate.getUTCDate() - 7);
    startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - 6);
  } else if (range === "monthly") {
    // Previous month
    startDate = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
    endDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
  } else if (range === "yearly") {
    // Previous year
    startDate = new Date(now.getUTCFullYear() - 1, 0, 1);
    endDate = new Date(now.getUTCFullYear(), 0, 1);
  } else {
    return 0;
  }

  // Format dates for comparison (YYYY-MM-DD format)
  const startKey = startDate.toISOString().split("T")[0];
  const endKey = endDate.toISOString().split("T")[0];

  const agg = await Course.aggregate([
    { $match: { institution: { $in: ids } } },
    { $unwind: { path: `$${rollupField}`, preserveNullAndEmptyArrays: false } },
    {
      $match: {
        [`${rollupField}.day`]: {
          $gte: startKey,
          $lt: endKey,
        },
      },
    },
    { $group: { _id: null, total: { $sum: `$${rollupField}.count` } } },
  ]);

  return agg[0]?.total || 0;
}

const checkOwnership = async (institutionId, userId) => {
  const institution = await Institution.findById(institutionId);
  if (!institution) {
    throw new AppError("No institution found with that ID", 404);
  }
  if (institution.institutionAdmin.toString() !== userId) {
    throw new AppError(
      "You are not authorized to perform this action for this institution",
      403,
    );
  }
  return institution;
};

exports.createCourse = asyncHandler(async (req, res, next) => {
  const userId = req.userId;
  const { courses, institutionType } = req.body;

  if (!Array.isArray(courses) || courses.length === 0) {
    return next(new AppError("No courses provided", 400));
  }

  if (!institutionType || !COURSE_MODEL_MAP[institutionType]) {
    return next(new AppError("Invalid institution type", 400));
  }

  const CourseModel = COURSE_MODEL_MAP[institutionType];

  // Verify admin
  const admin = await InstituteAdminModel.findOne({
    _id: userId,
    role: "INSTITUTE_ADMIN",
  });

  if (!admin) {
    return next(new AppError("Unauthorized", 403));
  }

  // Prepare course data
  const preparedCourses = courses.map((course) => ({
    ...course,
    institution: admin.institution,
    branch: mongoose.Types.ObjectId.isValid(course.branch)
      ? new mongoose.Types.ObjectId(course.branch)
      : null,
    status: "Inactive",
    createdAt: new Date(),
    updatedAt: new Date(),
    listingType: "free",
  }));

  await CourseModel.insertMany(preparedCourses);

  res.status(201).json({
    success: true,
    message: "Courses created successfully",
    count: preparedCourses.length,
  });
});

exports.getAllCoursesForInstitution = asyncHandler(async (req, res, next) => {
  const userId = req.userId;
  const limit = parseInt(req.query.limit, 10) || 10;
  const cursor = req.query.cursor;

  // 🔹 Find institution using institutionAdmin = userId
  const institution = await Institution.findOne({
    institutionAdmin: userId,
  });

  if (!institution) {
    return next(new AppError("Institution not found or unauthorized", 404));
  }

  const INSTITUTION_TYPE_MAP = {
    "Kindergarten/childcare center": "KINDERGARTEN",
    "School's": "SCHOOL",
    "Intermediate college(K12)": "INTERMEDIATE",
    "Under Graduation/Post Graduation": "UG_PG",
    "Exam Preparation": "EXAM_PREP",
    "Upskilling": "UPSKILLING",
    "Tution Center's": "TUTION_CENTER",
    "Study Abroad": "STUDY_ABROAD",
  };

  const mappedType =
    INSTITUTION_TYPE_MAP[institution.instituteType];

  if (!mappedType || !COURSE_MODEL_MAP[mappedType]) {
    return next(new AppError("Unsupported institution type", 400));
  }

  const CourseModel = COURSE_MODEL_MAP[mappedType];

  const query = {
    institution: institution._id,
  };

  if (cursor) {
    query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  const courses = await CourseModel.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1);

  let nextCursor = null;

  if (courses.length > limit) {
    const nextItem = courses.pop();
    nextCursor = nextItem._id;
  }

  // Map diverse name fields to standard courseName
  const mappedCourses = courses.map(course => {
    const courseObj = course.toObject ? course.toObject() : course;
    // Map specific fields based on detected keys if courseName is missing
    const name = courseObj.courseName ||
      courseObj.tutionCenterName ||
      courseObj.schoolName ||
      courseObj.intermediateName ||
      courseObj.consultancyName ||
      courseObj.selectBranch || // For UG_PG
      "Untitled Course";
    return { ...courseObj, courseName: name };
  });

  res.status(200).json({
    success: true,
    data: mappedCourses,
    nextCursor,
  });
});

exports.getCourseById = asyncHandler(async (req, res, next) => {
  const { courseId } = req.params;
  const { institutionType, isInstitutionSide } = req.body;
  const userId = req.userId;

  console.log(`📘 [getCourseById] Request received for Course ID: ${courseId}`);

  if (!institutionType || !COURSE_MODEL_MAP[institutionType]) {
    return res.status(400).json({
      success: false,
      message: "Invalid institution type",
    });
  }

  const CourseModel = COURSE_MODEL_MAP[institutionType];
  const CACHE_KEY = `course:${institutionType}:${courseId}`; // include institutionType in cache key

  try {
    // 1️⃣ CHECK GLOBAL CACHE
    const cached = await RedisUtil.getCachedCourses(CACHE_KEY);

    if (cached) {
      console.log("✅ Global cache hit");
      let parsed = JSON.parse(cached);
      // Ensure cached data has courseName
      if (parsed.data && !parsed.data.courseName) {
        const d = parsed.data;
        const n = d.courseName || d.tutionCenterName || d.schoolName || d.intermediateName || d.consultancyName || d.selectBranch || "Untitled Course";
        d.courseName = n;
      }

      // 🔥 UNIQUE VIEW TRACKING (skip if isInstitutionSide is true)
      if (!isInstitutionSide && userId && parsed.data?.institution?._id) {
        await RedisUtil.trackUniqueCourseViewOrImpression(
          "viewCourse",
          courseId,
          parsed.data.institution._id,
          userId
        );
      }
      return res.status(200).json(parsed);
    }

    // 2️⃣ FETCH COURSE DIRECTLY (no aggregation)
    console.log("⚙️ No cache — fetching course from DB");

    const course = await CourseModel.findById(courseId).lean();

    if (!course || course.status !== "Active") {
      return res.status(404).json({
        success: true,
        message: "Course not found or inactive",
        data: null,
      });
    }

    // Prepare final response
    const finalResponse = {
      course,
      institution: course.institution ? course.institution : null,
    };

    // 3️⃣ CACHE THE COURSE
    await RedisUtil.cacheCourse(CACHE_KEY, finalResponse, 600);
    console.log("🟢 Cached globally:", CACHE_KEY);

    // 4️⃣ UNIQUE VIEW TRACKING (skip if isInstitutionSide is true)
    if (!isInstitutionSide && userId && course.institution) {
      await RedisUtil.trackUniqueCourseViewOrImpression(
        "viewCourse",
        courseId,
        course.institution,
        userId
      );
    }

    return res.status(200).json(finalResponse);

  } catch (err) {
    console.error("❌ getCourseById Error:", err);
    return next(new AppError("Error fetching course data", 500));
  }
});


exports.updateCourse = asyncHandler(async (req, res, next) => {
  const { institutionId, courseId } = req.params;
  const { institutionType } = req.body;

  if (!institutionType || !COURSE_MODEL_MAP[institutionType]) {
    return next(new AppError("Invalid institution type", 400));
  }

  const CourseModel = COURSE_MODEL_MAP[institutionType];

  const admin = await InstituteAdminModel.findOne({
    _id: req.userId,
    role: "INSTITUTE_ADMIN",
    institution: institutionId,
  });

  if (!admin) {
    return next(new AppError("Unauthorized", 403));
  }

  const updateData = { ...req.body };

  if (updateData.branch) {
    updateData.branch = mongoose.Types.ObjectId.isValid(updateData.branch)
      ? new mongoose.Types.ObjectId(updateData.branch)
      : null;
  }

  updateData.updatedAt = new Date();

  const updatedCourse = await CourseModel.findOneAndUpdate(
    { _id: courseId, institution: institutionId },
    { $set: updateData },
    { new: true, runValidators: false, strict: false }
  );

  if (!updatedCourse) {
    return next(
      new AppError(
        "Course not found or does not belong to this institution",
        404
      )
    );
  }

  res.status(200).json({
    success: true,
    data: updatedCourse,
  });
});


exports.deleteCourse = asyncHandler(async (req, res, next) => {
  const { institutionId, courseId } = req.params;
  const { institutionType } = req.body; // expecting institutionType in body

  if (!institutionType || !COURSE_MODEL_MAP[institutionType]) {
    return next(new AppError("Invalid institution type", 400));
  }

  const CourseModel = COURSE_MODEL_MAP[institutionType];

  // Verify admin/ownership
  const admin = await InstituteAdminModel.findOne({
    _id: req.userId,
    role: "INSTITUTE_ADMIN",
    institution: institutionId, // ensures admin belongs to this institution
  });

  if (!admin) {
    return next(new AppError("Unauthorized", 403));
  }

  // Delete course in a single DB call while verifying ownership
  const deletedCourse = await CourseModel.findOneAndDelete({
    _id: courseId,
    institution: institutionId,
  });

  if (!deletedCourse) {
    return next(
      new AppError(
        "Course not found or does not belong to this institution",
        404
      )
    );
  }

  res.status(204).json({
    success: true,
    data: {},
  });
});


// Unified metric increment: /:courseId/metrics?metric=views|comparisons|leads
exports.incrementMetricUnified = asyncHandler(async (req, res, next) => {
  const raw = (req.query.metric || req.body.metric || "")
    .toString()
    .toLowerCase();
  const isViews = raw === "views" || raw === "courseviews";
  const isComparisons = raw === "comparisons" || raw === "comparison";
  const isLeads = raw === "leads" || raw === "leadsgenerated";

  if (!isViews && !isComparisons && !isLeads) {
    return next(
      new AppError("Invalid metric. Use metric=views|comparisons|leads", 400),
    );
  }

  const cfg = isViews
    ? {
      metricField: "courseViews",
      rollupField: "viewsRollups",
      updatedEvent: "courseViewsUpdated",
      institutionAdminTotalEvent: "institutionAdminTotalViews",
    }
    : isComparisons
      ? {
        metricField: "comparisons",
        rollupField: "comparisonRollups",
        updatedEvent: "comparisonsUpdated",
        institutionAdminTotalEvent: "institutionAdminTotalComparisons",
      }
      : {
        metricField: "leadsGenerated",
        rollupField: "leadsRollups",
        updatedEvent: "leadsUpdated",
        institutionAdminTotalEvent: "institutionAdminTotalLeads",
      };

  return incrementMetricGeneric(req, res, next, cfg);
});

// ----- Helpers: periods -----
function getCurrentPeriod(range) {
  const now = new Date();
  let startDate, endDate;
  if (range === "weekly") {
    startDate = new Date(now);
    startDate.setUTCDate(startDate.getUTCDate() - 6);
    endDate = new Date(now);
  } else if (range === "monthly") {
    startDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
    endDate = new Date(now);
  } else if (range === "yearly") {
    startDate = new Date(now.getUTCFullYear(), 0, 1);
    endDate = new Date(now);
  } else {
    startDate = new Date(now);
    startDate.setUTCDate(startDate.getUTCDate() - 6);
    endDate = new Date(now);
  }
  return { startDate, endDate };
}

function getPreviousPeriod(range) {
  const now = new Date();
  let startDate, endDate;
  if (range === "weekly") {
    endDate = new Date(now);
    endDate.setUTCDate(endDate.getUTCDate() - 7);
    startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - 6);
  } else if (range === "monthly") {
    startDate = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
    endDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
  } else if (range === "yearly") {
    startDate = new Date(now.getUTCFullYear() - 1, 0, 1);
    endDate = new Date(now.getUTCFullYear(), 0, 1);
  } else {
    endDate = new Date(now);
    endDate.setUTCDate(endDate.getUTCDate() - 7);
    startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - 6);
  }
  return { startDate, endDate };
}

// ----- Helpers: Course rollups aggregation -----
async function aggregateRollupsTotal(userId, rollupField, startDate, endDate) {
  const institutions = await Institution.find({
    institutionAdmin: userId,
  }).select("_id");
  const ids = institutions.map((i) => i._id);
  if (ids.length === 0) return 0;
  const startKey = startDate.toISOString().split("T")[0];
  const endKey = endDate.toISOString().split("T")[0];
  const agg = await Course.aggregate([
    { $match: { institution: { $in: ids } } },
    { $unwind: { path: `$${rollupField}`, preserveNullAndEmptyArrays: false } },
    { $match: { [`${rollupField}.day`]: { $gte: startKey, $lte: endKey } } },
    { $group: { _id: null, total: { $sum: `$${rollupField}.count` } } },
  ]);
  return agg[0]?.total || 0;
}

// ----- Helpers: student-based leads -----
async function countStudentsInRange(userId, startDate, endDate) {
  const institutions = await Institution.find({
    institutionAdmin: userId,
  }).select("_id");
  const ids = institutions.map((i) => i._id);
  if (ids.length === 0) return 0;
  return InstituteAdminModel.countDocuments({
    institution: { $in: ids },
    role: "STUDENT",
    createdAt: { $gte: startDate, $lte: endDate },
  });
}

async function countStudentsTotal(userId) {
  const institutions = await Institution.find({
    institutionAdmin: userId,
  }).select("_id");
  const ids = institutions.map((i) => i._id);
  if (ids.length === 0) return 0;
  return InstituteAdminModel.countDocuments({
    institution: { $in: ids },
    role: "STUDENT",
  });
}

// ----- Unified institutionAdmin metric summary -----
// GET /summary/metrics/institutionAdmin?metric=views|comparisons|leads
exports.getInstitutionAdminMetricSummaryUnified = asyncHandler(
  async (req, res, next) => {
    const raw = (req.query.metric || "").toString().toLowerCase();
    const isViews = raw === "views" || raw === "courseviews";
    const isComparisons = raw === "comparisons" || raw === "comparison";
    const isLeads = raw === "leads" || raw === "leadsgenerated";

    if (!isViews && !isComparisons && !isLeads)
      return next(
        new AppError("Invalid metric. Use metric=views|comparisons|leads", 400),
      );

    if (isLeads) {
      const totalLeads = await countStudentsTotal(req.userId);
      return res.status(200).json({ success: true, data: { totalLeads } });
    }

    // Fallback totals from Course
    const institutions = await Institution.find({
      institutionAdmin: req.userId,
    }).select("_id");
    const ids = institutions.map((i) => i._id);
    if (ids.length === 0) {
      if (isViews)
        return res.status(200).json({ success: true, data: { totalViews: 0 } });
      return res
        .status(200)
        .json({ success: true, data: { totalComparisons: 0 } });
    }
    const groupField = isViews ? "$courseViews" : "$comparisons";
    const agg = await Course.aggregate([
      { $match: { institution: { $in: ids } } },
      { $group: { _id: null, total: { $sum: { $ifNull: [groupField, 0] } } } },
    ]);
    const total = agg[0]?.total || 0;
    if (isViews)
      return res
        .status(200)
        .json({ success: true, data: { totalViews: total } });
    return res
      .status(200)
      .json({ success: true, data: { totalComparisons: total } });
  },
);

// ----- Unified institutionAdmin metric by range -----
// GET /summary/metrics/institutionAdmin/range?metric=views|comparisons|leads&range=weekly|monthly|yearly
exports.getInstitutionAdminMetricByRangeUnified = asyncHandler(
  async (req, res, next) => {
    const raw = (req.query.metric || "").toString().toLowerCase();
    const range = (req.query.range || "weekly").toString().toLowerCase();
    const isViews = raw === "views" || raw === "courseviews";
    const isComparisons = raw === "comparisons" || raw === "comparison";
    const isLeads = raw === "leads" || raw === "leadsgenerated";

    if (!isViews && !isComparisons && !isLeads)
      return next(
        new AppError("Invalid metric. Use metric=views|comparisons|leads", 400),
      );

    if (isLeads) {
      const { startDate: cs, endDate: ce } = getCurrentPeriod(range);
      const { startDate: ps, endDate: pe } = getPreviousPeriod(range);
      const current = await countStudentsInRange(req.userId, cs, ce);
      const previous = await countStudentsInRange(req.userId, ps, pe);
      const trend = previous > 0 ? ((current - previous) / previous) * 100 : 0;
      return res.status(200).json({
        success: true,
        data: {
          totalLeads: current,
          trend: { value: Math.abs(trend), isPositive: trend >= 0 },
        },
      });
    }

    const rollupField = isViews ? "viewsRollups" : "comparisonRollups";
    const { startDate: cs, endDate: ce } = getCurrentPeriod(range);
    const { startDate: ps, endDate: pe } = getPreviousPeriod(range);
    const current = await aggregateRollupsTotal(
      req.userId,
      rollupField,
      cs,
      ce,
    );
    const previous = await aggregateRollupsTotal(
      req.userId,
      rollupField,
      ps,
      pe,
    );
    const trend = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    if (isViews)
      return res.status(200).json({
        success: true,
        data: {
          totalViews: current,
          trend: { value: Math.abs(trend), isPositive: trend >= 0 },
        },
      });
    return res.status(200).json({
      success: true,
      data: {
        totalComparisons: current,
        trend: { value: Math.abs(trend), isPositive: trend >= 0 },
      },
    });
  },
);

// ----- Series: monthly counts for a given year -----
exports.getInstitutionAdminMetricSeriesUnified = asyncHandler(
  async (req, res, next) => {
    const raw = (req.query.metric || "").toString().toLowerCase();
    const year = parseInt(req.query.year, 10) || new Date().getUTCFullYear();
    const isViews = raw === "views" || raw === "courseviews";
    const isComparisons = raw === "comparisons" || raw === "comparison";
    const isLeads = raw === "leads" || raw === "leadsgenerated";
    if (!isViews && !isComparisons && !isLeads) {
      return next(
        new AppError("Invalid metric. Use metric=views|comparisons|leads", 400),
      );
    }

    const institutions = await Institution.find({
      institutionAdmin: req.userId,
    }).select("_id");
    const ids = institutions.map((i) => i._id);
    if (ids.length === 0) {
      return res
        .status(200)
        .json({ success: true, data: { series: new Array(12).fill(0) } });
    }

    if (isLeads) {
      const series = [];
      for (let m = 0; m < 12; m++) {
        const startDate = new Date(Date.UTC(year, m, 1));
        const endDate = new Date(Date.UTC(year, m + 1, 0, 23, 59, 59, 999));
        // inclusive end
        const count = await InstituteAdminModel.countDocuments({
          institution: { $in: ids },
          role: "STUDENT",
          createdAt: { $gte: startDate, $lte: endDate },
        });
        series.push(count);
      }
      return res.status(200).json({ success: true, data: { series } });
    }

    // Views or comparisons via rollups
    const rollupField = isViews ? "viewsRollups" : "comparisonRollups";
    const series = [];
    for (let m = 0; m < 12; m++) {
      const startDate = new Date(Date.UTC(year, m, 1));
      const endDate = new Date(Date.UTC(year, m + 1, 0, 23, 59, 59, 999));
      const startKey = startDate.toISOString().split("T")[0];
      const endKey = endDate.toISOString().split("T")[0];
      const agg = await Course.aggregate([
        { $match: { institution: { $in: ids } } },
        {
          $unwind: {
            path: `$${rollupField}`,
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $match: { [`${rollupField}.day`]: { $gte: startKey, $lte: endKey } },
        },
        { $group: { _id: null, total: { $sum: `$${rollupField}.count` } } },
      ]);
      series.push(agg[0]?.total || 0);
    }
    return res.status(200).json({ success: true, data: { series } });
  },
);

exports.requestCallback = asyncHandler(async (req, res, next) => {
  const { institutionId, courseId } = req.params;
  const userId = req.userId;

  console.log(
    `📞 [requestCallback] Request from user ${userId} for institution ${institutionId}, course ${courseId}`,
  );

  try {
    let subscription = null;
    const now = new Date();

    // 1️⃣ Check subscription cache first
    const cachedSub = await RedisUtil.getCachedSubscription(institutionId);
    if (cachedSub) {
      console.log("✅ Subscription cache hit");
      subscription = JSON.parse(cachedSub);

      const isActive =
        subscription.status === "active" &&
        new Date(subscription.startDate) <= now &&
        new Date(subscription.endDate) > now;

      if (!isActive) {
        console.warn(
          "⚠️ Cached subscription expired or invalid — fetching from DB",
        );
        subscription = null;
      }
    } else {
      console.log("⚙️ No cached subscription found — will query MongoDB");
    }

    // 2️⃣ If no valid cached subscription, fetch from MongoDB
    if (!subscription) {
      const subscriptionFromDB = await Subscription.findOne({
        institution: institutionId,
        status: "active",
        startDate: { $lte: now },
        endDate: { $gt: now },
      });

      if (!subscriptionFromDB) {
        console.warn("❌ No valid active subscription found in DB");
        return res.status(403).json({
          success: false,
          message: "Institution subscription inactive or expired",
        });
      }

      subscription = subscriptionFromDB.toObject();

      // Cache it for 5 minutes
      await RedisUtil.cacheSubscription(institutionId, subscription, 300);
      console.log("💾 Cached fresh subscription data from DB");
    }

    // 3️⃣ If reached here, subscription is valid — continue logic
    console.log(
      "✅ Valid subscription confirmed — proceeding with callback flow",
    );

    // ⬇️ Continue your callback logic below (e.g., record callback request)
    // For example:
    // await CallbackRequest.create({ userId, institutionId, courseId, createdAt: new Date() });

    return res.status(200).json({
      success: true,
      message: "Callback request accepted",
    });
  } catch (error) {
    console.error("❌ [requestCallback] Error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing the callback request.",
      error: error.message,
    });
  }
});

exports.searchCourses = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const from = (page - 1) * limit;
  const { q } = req.query;

  // 🔍 Elasticsearch query
  const esQuery = q
    ? {
      multi_match: {
        query: q,
        fields: ["courseName", "selectBranch"],
        fuzziness: "AUTO",
      },
    }
    : { match_all: {} };

  // 🧠 Search in Elasticsearch
  const result = await esClient.search({
    index: "courses_index",
    from,
    size: limit,
    query: esQuery,
  });

  const ids = result.hits.hits.map((hit) => hit._source.id);

  if (!ids.length) {
    return res.status(200).json({
      success: true,
      total: 0,
      currentPage: page,
      totalPages: 0,
      data: [],
    });
  }

  // 🧩 MongoDB Aggregation to join institution info
  const mongoResults = await Course.aggregate([
    {
      $match: {
        _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
      },
    },

    {
      $lookup: {
        from: "institutions",
        localField: "institution",
        foreignField: "_id",
        as: "institutionDetails",
      },
    },
    { $unwind: "$institutionDetails" },

    {
      $lookup: {
        from: "wishlists",
        let: { courseId: "$_id", userId: new mongoose.Types.ObjectId(userId) },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$courseId", "$$courseId"] },
                  { $eq: ["$userId", "$$userId"] },
                ],
              },
            },
          },
        ],
        as: "wishlistEntry",
      },
    },

    // Compute isWishlisted
    {
      $addFields: {
        isWishlisted: { $gt: [{ $size: "$wishlistEntry" }, 0] },
      },
    },

    {
      $project: {
        _id: 1,
        priceOfCourse: 1,
        courseDuration: 1,
        courseName: 1,
        imageUrl: 1,
        selectBranch: 1,
        isWishlisted: 1,
        "institutionDetails._id": 1,
        "institutionDetails.instituteName": 1,
        "institutionDetails.logoUrl": 1,
        "institutionDetails.locationURL": 1,
      },
    },
  ]);

  // Maintain ES order (by relevance)
  const orderedResults = ids
    .map((id) => mongoResults.find((course) => course._id.toString() === id))
    .filter(Boolean);

  if (userId) {
    for (const course of orderedResults) {
      RedisUtil.trackUniqueCourseViewOrImpression(
        "leadImpression",
        course._id.toString(),
        course.institutionDetails._id.toString(),
        userId,
      );
    }
  }

  // 🧾 Send response
  res.status(200).json({
    success: true,
    total: result.hits.total.value,
    currentPage: page,
    totalPages: Math.ceil(result.hits.total.value / limit),
    data: orderedResults,
  });
});

const PRICE_RANGES = {
  "Below ₹75,000": { min: 0, max: 74999 },
  "₹75,000 - ₹1,50,000": { min: 75000, max: 150000 },
  "₹1,50,000 - ₹3,00,000": { min: 150001, max: 300000 },
  "Above ₹3,00,000": { min: 300001, max: Number.MAX_SAFE_INTEGER },
};

const INSTITUTE_TYPE_MAP = {
  Kindergarten: "Kindergarten/childcare center",
  School: "School's",
  Intermediate: "Intermediate college(K12)",
  Graduation: "Under Graduation/Post Graduation",
  Coaching: "Coaching centers",
  "Study Hall's": "Study Halls",
  "Tuition Center's": "Tution Center's",
  "Study Abroad": "Study Abroad",
};

function convertYearsToMonths(label) {
  if (!label) return null;
  const match = label.match(/([\d.]+)\s*Yr/);
  if (!match) return label;

  const years = parseFloat(match[1]);
  const months = Math.round(years * 12);
  return `${months} Months`;
}

/* -------------------------------------------------------------------------- */
/*                      BUILD COURSE + INSTITUTION FILTERS                    */
/* -------------------------------------------------------------------------- */

function buildConditionsFromFilters(filters = {}) {
  const courseCond = {};
  const instCond = {};

  if (filters.instituteType) {
    instCond["institution.instituteType"] =
      INSTITUTE_TYPE_MAP[filters.instituteType] || filters.instituteType;
  }

  if (filters.institutes?.length) {
    const ids = [];
    const names = [];

    for (const v of filters.institutes) {
      /^[0-9a-fA-F]{24}$/.test(v) ? ids.push(ObjectId(v)) : names.push(v);
    }

    instCond.$or = [];
    if (ids.length) instCond.$or.push({ "institution._id": { $in: ids } });
    if (names.length)
      instCond.$or.push({
        "institution.instituteName": { $in: names },
      });
  }

  if (filters.seatingType?.length)
    instCond["institution.seatingType"] = { $in: filters.seatingType };

  if (filters.operatingHours?.length)
    instCond["institution.operatingHours"] = { $in: filters.operatingHours };

  if (filters.boardType?.length) {
    instCond.$or = instCond.$or || [];
    instCond.$or.push({
      "institution.curriculumType": { $in: filters.boardType },
    });
    instCond.$or.push({
      "institution.boardType": { $in: filters.boardType },
    });
  }

  if (filters.modes?.length) courseCond.mode = { $in: filters.modes };

  if (filters.graduationType?.length)
    courseCond.graduationType = { $in: filters.graduationType };

  if (filters.streamType?.length)
    courseCond.streamType = { $in: filters.streamType };

  if (filters.educationType?.length)
    courseCond.educationType = { $in: filters.educationType };

  if (filters.programDuration?.length) {
    const durations = filters.programDuration.map(convertYearsToMonths);
    courseCond.courseDuration = { $in: durations };
  }

  if (filters.ageGroup?.length) {
    courseCond.$or = courseCond.$or || [];
    courseCond.$or.push({ ageGroup: { $in: filters.ageGroup } });
    courseCond.$or.push({ ageGroupLabel: { $in: filters.ageGroup } });
  }

  if (filters.kindergartenLevels?.length) {
    courseCond.$or = courseCond.$or || [];
    courseCond.$or.push({
      selectBranch: { $in: filters.kindergartenLevels },
    });
    courseCond.$or.push({
      courseName: { $in: filters.kindergartenLevels },
    });
  }

  if (filters.schoolLevels?.length) {
    courseCond.$or = courseCond.$or || [];
    courseCond.$or.push({
      selectBranch: { $in: filters.schoolLevels },
    });
    courseCond.$or.push({
      courseName: { $in: filters.schoolLevels },
    });
  }

  if (filters.subjects?.length) courseCond.subject = { $in: filters.subjects };

  if (filters.priceRange?.length) {
    const priceOr = [];
    for (let label of filters.priceRange) {
      const r = PRICE_RANGES[label];
      if (!r) continue;

      const cond = {};
      if (r.min !== undefined) cond.$gte = r.min;
      if (r.max !== Number.MAX_SAFE_INTEGER) cond.$lte = r.max;

      priceOr.push({ priceOfCourse: cond });
    }
    if (priceOr.length) courseCond.$or = (courseCond.$or || []).concat(priceOr);
  }

  return { courseCond, instCond };
}

/* -------------------------------------------------------------------------- */
/*                         MAIN AGGREGATION PIPELINE                          */
/* -------------------------------------------------------------------------- */

async function runAggregation(courseCond, instCond, userId) {
  const pipeline = [];

  pipeline.push({
    $match: {
      status: "Active",
      ...(courseCond || {}),
    },
  });

  pipeline.push({
    $lookup: {
      from: "institutions",
      localField: "institution",
      foreignField: "_id",
      as: "institution",
    },
  });

  pipeline.push({ $unwind: "$institution" });

  if (instCond && Object.keys(instCond).length) {
    pipeline.push({ $match: instCond });
  }

  pipeline.push({
    $lookup: {
      from: "wishlists",
      let: { courseId: "$_id", userId: new ObjectId(userId) },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$courseId", "$$courseId"] },
                { $eq: ["$userId", "$$userId"] },
              ],
            },
          },
        },
      ],
      as: "wishlistEntry",
    },
  });

  pipeline.push({
    $addFields: {
      isWishlisted: { $gt: [{ $size: "$wishlistEntry" }, 0] },
      institutionDetails: "$institution", // rename
      institution: 0,
    },
  });

  pipeline.push({
    $project: {
      wishlistEntry: 0,
    },
  });

  return await Course.aggregate(pipeline).allowDiskUse(true);
}

/* -------------------------------------------------------------------------- */
/*                         FILTER COURSE CONTROLLER                            */
/* -------------------------------------------------------------------------- */

exports.filterCourses = async (req, res) => {
  const userId = req.userId;

  try {
    let filters = {
      ...(req.body || {}),
      ...(req.query || {}),
    };

    for (const key of Object.keys(filters)) {
      let value = filters[key];

      if (!value) {
        delete filters[key];
        continue;
      }

      if (typeof value === "string") {
        value =
          key === "priceRange"
            ? [value.trim()]
            : value.includes(",")
              ? value.split(",").map((v) => v.trim())
              : [value.trim()];
      }

      if (!Array.isArray(value)) value = [value];

      filters[key] = value;
    }

    const { courseCond, instCond } = buildConditionsFromFilters(filters);

    const results = await runAggregation(courseCond, instCond, userId);

    if (!results.length) {
      return res.status(404).json({
        success: false,
        message: "No course found",
      });
    }

    if (userId) {
      for (const course of results) {
        RedisUtil.trackUniqueCourseViewOrImpression(
          "leadImpression",
          course._id.toString(),
          course.institutionDetails._id.toString(),
          userId,
        );
      }
    }

    return res.status(200).json({
      success: true,
      data: results,
      appliedFilters: filters,
    });
  } catch (err) {
    console.error("filterCourses error", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.updateStatsAndCreateEnquiry = async (req, res) => {
  try {
    const userId = req.userId;
    const { institutionId, courseId, type } = req.body;

    if (!institutionId || !courseId || !type) {
      return res.status(400).json({
        message: "institutionId, courseId and type are required",
      });
    }

    const typeMapping = {
      demoRequest: {
        statField: "requestDemoCount",
        enquiryType: "Requested for demo",
        redisPrefix: "bookDemoRequest",
      },
      callRequest: {
        statField: "callRequestCount",
        enquiryType: "Requested for callback",
        redisPrefix: "callbackRequest",
      },
    };

    if (!typeMapping[type]) {
      return res
        .status(400)
        .json({ message: "Invalid type. Must be demoRequest or callRequest" });
    }

    const { statField, enquiryType } = typeMapping[type];

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // STEP 1 — Increase stat count
        await UserStats.findOneAndUpdate(
          { userId },
          { $inc: { [statField]: 1 } },
          { upsert: true, new: true, session },
        );

        // STEP 2 — Create enquiry
        await Enquiries.create(
          [
            {
              institution: institutionId,
              programInterest: "",
              enquiryType,
              student: userId,
              status: enquiryType,
              statusHistory: [
                {
                  status: enquiryType,
                  changedBy: userId,
                  changedAt: new Date(),
                  notes: "",
                },
              ],
            },
          ],
          { session },
        );
      });

      session.endSession();
      return res.status(200).json({
        success: true,
        message: "Stats updated & enquiry created successfully",
      });
    } catch (error) {
      session.endSession();
      console.error("Transaction Error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update stats & create enquiry",
      });
    }

    // TRACK ANALYTICS IN REDIS
    const analyticsKey = `${typeData.redisPrefix}:${courseId}:${institutionId}`;
    await RedisUtil.trackUniqueCourseViewOrImpression(
      analyticsKey,
      courseId,
      institutionId,
      userId
    );

    // PUSH ENQUIRY INTO QUEUE
    const enquiryPayload = {
      institutionId,
      courseId,
      userId,
      enquiryType: typeData.enquiryType,
      timestamp: Date.now(),
    };

    await redisClient.rpush("pendingEnquiries", JSON.stringify(enquiryPayload));

    // INCREMENT USERSTATS QUEUE
    await redisClient.hset("pendingUserStats", userId, typeData.statField);

    return res.status(200).json({
      success: true,
      message: "Enquiry received successfully",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal error" });
  }
};
