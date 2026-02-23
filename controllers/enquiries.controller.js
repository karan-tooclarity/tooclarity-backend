const Enquiries = require("../models/Enquiries");
const { Institution } = require("../models/Institution");
const InstituteAdminModel = require("../models/InstituteAdmin");
const AppError = require("../utils/appError");
const asyncHandler = require("express-async-handler");
const COURSE_MODEL_MAP = require("../utils/CourseMap");

async function getInstitutionAdminLeadsTotal(institutionAdminId) {
  const institutions = await Institution.find({ institutionAdmin: institutionAdminId }).select("_id");
  const ids = institutions.map(i => i._id);
  if (ids.length === 0) return 0;

  // Count ONLY enquiries that are leads (callback/demo) across the institutionAdmin's institutions
  const count = await Enquiries.countDocuments({
    institution: { $in: ids },
    enquiryType: { $in: [/^callback$/i, /^demo$/i] }
  });

  return count;
}

async function getInstitutionAdminEnquiriesMonthly(institutionAdminId, year) {
  const institutions = await Institution.find({ institutionAdmin: institutionAdminId }).select("_id");
  const ids = institutions.map(i => i._id);
  if (ids.length === 0) return [];

  const monthlyData = [];
  for (let month = 1; month <= 12; month++) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const count = await Enquiries.countDocuments({
      institution: { $in: ids },
      createdAt: { $gte: startDate, $lte: endDate },
      enquiryType: { $in: [/^callback$/i, /^demo$/i] }
    });

    monthlyData.push({ month, count });
  }

  return monthlyData;
}


function getPeriod(range) {
  const now = new Date();
  let startDate, endDate;
  const r = (range || 'weekly').toString().toLowerCase();
  if (r === 'weekly') {
    startDate = new Date(now); startDate.setUTCDate(startDate.getUTCDate() - 6); endDate = new Date(now);
  } else if (r === 'monthly') {
    startDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1); endDate = new Date(now);
  } else if (r === 'yearly') {
    startDate = new Date(now.getUTCFullYear(), 0, 1); endDate = new Date(now);
  } else {
    startDate = new Date(now); startDate.setUTCDate(startDate.getUTCDate() - 6); endDate = new Date(now);
  }
  return { startDate, endDate };
}

async function countByTypeInRange(institutionAdminId, startDate, endDate) {
  const institutions = await Institution.find({ institutionAdmin: institutionAdminId }).select("_id");
  const ids = institutions.map(i => i._id);
  if (ids.length === 0) return { callbacks: 0, demos: 0 };
  const [callbacks, demos] = await Promise.all([
    Enquiries.countDocuments({ institution: { $in: ids }, createdAt: { $gte: startDate, $lte: endDate }, enquiryType: /callback/i }),
    Enquiries.countDocuments({ institution: { $in: ids }, createdAt: { $gte: startDate, $lte: endDate }, enquiryType: /demo/i })
  ]);
  return { callbacks, demos };
}

exports.getInstitutionAdminLeadsSummary = asyncHandler(async (req, res, next) => {
  const totalLeads = await getInstitutionAdminLeadsTotal(req.userId);
  res.status(200).json({
    success: true,
    data: { totalLeads }
  });
});

exports.getInstitutionAdminEnquiriesForChart = asyncHandler(async (req, res, next) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const data = await getInstitutionAdminEnquiriesMonthly(req.userId, year);
  res.status(200).json({
    success: true,
    data: { enquiriesData: data }
  });
});

exports.getInstitutionAdminRecentEnquiries = asyncHandler(async (req, res, next) => {
  const limit = Math.max(1, Math.min(10000, parseInt(req.query.limit) || 10));
  const offset = Math.max(0, parseInt(req.query.offset) || 0);
  const institutions = await Institution.find({ institutionAdmin: req.userId }).select("_id");
  const ids = institutions.map(i => i._id);
  console.log(`[DEBUG] Institution admin ${req.userId} has ${ids.length} institutions:`, ids);
  if (ids.length === 0) return res.status(200).json({ success: true, data: { enquiries: [] } });

  // Fetch enquiries directly from Enquiries collection for these institutions
  const enquiries = await Enquiries.find({
    institution: { $in: ids },
    listingType: "paid"
  })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .populate('institution', 'institutionName headquartersAddress locationURL')
    .populate({
      path: 'student',
      select: 'name email contactNumber address role',
      match: { role: 'STUDENT' }
    });

  console.log(`[DEBUG] getInstitutionAdminRecentEnquiries (direct): offset: ${offset}, limit: ${limit}, found: ${enquiries.length}`);

  // Debug: Log first enquiry to see populated student data
  if (enquiries.length > 0) {
    console.log(`[DEBUG] First enquiry student data:`, {
      studentId: enquiries[0].student?._id,
      studentName: enquiries[0].student?.name,
      studentEmail: enquiries[0].student?.email,
      studentPhone: enquiries[0].student?.contactNumber
    });
  }

  res.status(200).json({
    success: true,
    data: { enquiries }
  });
});

// List students belonging to institutions managed by the current institution admin
exports.getInstitutionAdminStudents = asyncHandler(async (req, res, next) => {
  const limit = Math.max(1, Math.min(10000, parseInt(req.query.limit) || 10));
  const offset = Math.max(0, parseInt(req.query.offset) || 0);

  const institutions = await Institution.find({ institutionAdmin: req.userId }).select("_id");
  const ids = institutions.map(i => i._id);
  if (ids.length === 0) return res.status(200).json({ success: true, data: { students: [] } });

  const students = await InstituteAdminModel.find({
    institution: { $in: ids },
    role: 'STUDENT'
  })
    .select('name email contactNumber address createdAt')
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);

  return res.status(200).json({ success: true, data: { students } });
});

// Get students that belong to the same institution as a given enquiry
// Uses Enquiries (to resolve institution) and InstituteAdmin (to fetch role: STUDENT)
exports.getStudentsByEnquiryInstitution = asyncHandler(async (req, res, next) => {
  const { enquiryId } = req.params;

  if (!enquiryId) {
    return res.status(400).json({ success: false, message: 'enquiryId is required' });
  }

  const enquiry = await Enquiries.findById(enquiryId).select('institution');
  if (!enquiry || !enquiry.institution) {
    return res.status(404).json({ success: false, message: 'Enquiry or institution not found' });
  }

  const limit = Math.max(1, Math.min(10000, parseInt(req.query.limit) || 10));
  const offset = Math.max(0, parseInt(req.query.offset) || 0);

  const students = await InstituteAdminModel.find({
    institution: enquiry.institution,
    role: 'STUDENT'
  })
    .select('name email contactNumber address createdAt')
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);

  return res.status(200).json({ success: true, data: { students } });
});

exports.updateEnquiryStatus = asyncHandler(async (req, res, next) => {
  const { enquiryId } = req.params;
  const { status, notes } = req.body;
  const userId = req.userId;

  console.log('[DEBUG] updateEnquiryStatus called:', { enquiryId, status, notes, userId });

  // Validate status
  const validStatuses = [
    // Initial enquiry types from students
    "Requested for callback",
    "Requested for demo",
    // Progressed statuses by institution admin
    "Contacted",
    "Interested",
    "Demo Scheduled",
    "Follow Up Required",
    "Qualified",
    "Not Interested",
    "Converted"
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    });
  }

  // Find the enquiry and verify it belongs to the institution admin's institutions
  const enquiry = await Enquiries.findById(enquiryId)
    .populate('institution', 'institutionAdmin')
    .populate('student', 'name email');

  if (!enquiry) {
    return res.status(404).json({
      success: false,
      message: 'Enquiry not found'
    });
  }

  // Verify the enquiry belongs to the institution admin's institutions
  const institutions = await Institution.find({ institutionAdmin: userId }).select("_id");
  const institutionIds = institutions.map(i => i._id);

  if (!institutionIds.some(id => id.toString() === enquiry.institution._id.toString())) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to update this enquiry'
    });
  }

  // Update status and add to history
  const oldStatus = enquiry.status;
  enquiry.status = status;

  // Add to status history
  enquiry.statusHistory.push({
    status: status,
    changedBy: userId,
    changedAt: new Date(),
    notes: notes || ''
  });

  await enquiry.save();

  console.log('[DEBUG] Enquiry status updated successfully:', { enquiryId, oldStatus, newStatus: status });

  // Emit real-time update
  try {
    const io = req.app.get("io");
    if (io) {
      io.to(`institution:${enquiry.institution._id}`).emit("enquiryStatusUpdated", {
        enquiryId: enquiry._id,
        oldStatus,
        newStatus: status,
        updatedBy: userId,
        student: enquiry.student
      });

      // Notify institution admin
      if (enquiry.institution.institutionAdmin) {
        io.to(`institutionAdmin:${enquiry.institution.institutionAdmin}`).emit("enquiryStatusUpdated", {
          enquiryId: enquiry._id,
          oldStatus,
          newStatus: status,
          updatedBy: userId,
          student: enquiry.student
        });
      }
    }
  } catch (err) {
    console.error('EnquiriesController: emit status update failed', err?.message || err);
  }

  res.status(200).json({
    success: true,
    message: 'Enquiry status updated successfully',
    data: {
      enquiryId: enquiry._id,
      oldStatus,
      newStatus: status,
      updatedAt: enquiry.updatedAt
    }
  });
});

// exports.createEnquiry = asyncHandler(async (req, res, next) => {
//   const { institution, programInterest, enquiryType, courseId, listingType } = req.body;

//   // If the caller is an authenticated student, always use their id
//   let studentId = req.body.student;
//   if (req.userRole === 'STUDENT') {
//     studentId = req.userId;
//   }
//   if (!studentId) {
//     return res.status(400).json({ success: false, message: 'student id is required' });
//   }
//   if (!institution) {
//     return res.status(400).json({ success: false, message: 'institution id is required' });
//   }
//   if (!programInterest || !enquiryType) {
//     return res.status(400).json({ success: false, message: 'programInterest and enquiryType are required' });
//   }

//   const enquiry = await Enquiries.create({
//     student: studentId,
//     institution,
//     programInterest,
//     enquiryType,
//     // Add new fields
//     courseId,
//     listingType: listingType || 'paid', // Default to paid if not provided
//     status: enquiryType, // Set initial status from enquiryType
//     statusHistory: [{
//       status: enquiryType,
//       changedBy: studentId, // Student who created the enquiry
//       changedAt: new Date(),
//       notes: 'Initial enquiry created'
//     }]
//   });

//   // No longer push enquiry into student's enquiries array (field removed)

//   try {
//     const io = req.app.get("io");
//     if (io) {
//       io.to(`institution:${institution}`).emit("enquiryCreated", { enquiry });

//       // Update Institution rollups for callback/demo
//       try {
//         const { Institution } = require("../models/Institution");
//         const instDoc = await Institution.findById(institution).select('_id institutionAdmin callbackLeadsTotal demoLeadsTotal callbackRollups demoRollups');
//         if (instDoc) {
//           const now = new Date();
//           const yyyy = now.getUTCFullYear();
//           const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
//           const dd = String(now.getUTCDate()).padStart(2, '0');
//           const dayKey = `${yyyy}-${mm}-${dd}`;
//           const isCallback = /callback/i.test(enquiryType || '');
//           const isDemo = /demo/i.test(enquiryType || '');
//           const updates = {};
//           if (isCallback) updates['callbackLeadsTotal'] = (instDoc.callbackLeadsTotal || 0) + 1;
//           if (isDemo) updates['demoLeadsTotal'] = (instDoc.demoLeadsTotal || 0) + 1;
//           // rollups
//           if (isCallback) {
//             const idx = (instDoc.callbackRollups || []).findIndex(r => r.day === dayKey);
//             if (idx >= 0) instDoc.callbackRollups[idx].count += 1; else instDoc.callbackRollups.push({ day: dayKey, count: 1 });
//           }
//           if (isDemo) {
//             const idx = (instDoc.demoRollups || []).findIndex(r => r.day === dayKey);
//             if (idx >= 0) instDoc.demoRollups[idx].count += 1; else instDoc.demoRollups.push({ day: dayKey, count: 1 });
//           }
//           if (Object.keys(updates).length > 0) {
//             Object.assign(instDoc, updates);
//             await instDoc.save();
//           }
//         }
//       } catch (err) {
//         console.error('EnquiriesController: update institution rollups failed', err?.message || err);
//       }

//       const inst = await Institution.findById(institution).select("institutionAdmin");
//       if (inst?.institutionAdmin) {
//         const adminId = String(inst.institutionAdmin);
//         io.to(`institutionAdmin:${adminId}`).emit("enquiryCreated", {
//           enquiry,
//           // Include new fields for realtime clients
//           courseId: enquiry.courseId,
//           listingType: enquiry.listingType
//         });
//         // Notify institution admin via notifications channel
//         try {
//           const { addNotificationJob } = require('../jobs/notification.job');
//           await addNotificationJob({
//             title: 'Callback/Demo requested',
//             description: `${enquiry.enquiryType} - ${enquiry.programInterest}`,
//             category: 'user',
//             recipientType: 'ADMIN',
//             institutionAdmin: adminId,
//             metadata: {
//               enquiryId: String(enquiry._id),
//               institution: String(institution),
//               courseId: enquiry.courseId ? String(enquiry.courseId) : undefined,
//               listingType: enquiry.listingType
//             }
//           });
//         } catch (_) { }

//         // Emit updated leads total (based on students now)
//         const totalLeads = await getInstitutionAdminLeadsTotal(adminId);
//         io.to(`institutionAdmin:${adminId}`).emit("institutionAdminTotalLeads", { totalLeads });
//       }
//     }
//   } catch (err) {
//     console.error('EnquiriesController: create enquiry handler failed', err?.message || err);
//   }

//   res.status(201).json({
//     success: true,
//     data: enquiry
//   });
// });

exports.createEnquiry = asyncHandler(async (req, res, next) => {
  const { programInterest, enquiryType, courseId, listingType, institutionType } = req.body;

  if (!institutionType || !COURSE_MODEL_MAP[institutionType]) {
    return res.status(400).json({
      success: false,
      message: "Invalid institution type",
    });
  }

  if (!courseId) {
    return res.status(400).json({
      success: false,
      message: "courseId is required",
    });
  }

  const CourseModel = COURSE_MODEL_MAP[institutionType];

  // 🔹 Get institution directly from course
  const course = await CourseModel.findById(courseId).select("institution");
  if (!course) {
    return res.status(404).json({
      success: false,
      message: "Course not found",
    });
  }

  const institution = course.institution;

  // 🔹 Determine studentId
  // let studentId = req.body.student;
  // if (req.userRole === "STUDENT") {
  //   studentId = req.userId;
  // }

  // if (!studentId) {
  //   return res.status(400).json({
  //     success: false,
  //     message: "student id is required",
  //   });
  // }

  if (!programInterest || !enquiryType) {
    return res.status(400).json({
      success: false,
      message: "programInterest and enquiryType are required",
    });
  }

  // 🔹 Create enquiry
  const enquiry = await Enquiries.create({
    student: req.userId,
    institution,
    programInterest,
    enquiryType,
    courseId,
    listingType: listingType || "paid",
    status: enquiryType,
    statusHistory: [
      {
        status: enquiryType,
        changedBy: studentId,
        changedAt: new Date(),
        notes: "Initial enquiry created",
      },
    ],
  });

  // 🔹 Realtime + rollups logic remains same (no need to change)
  try {
    const io = req.app.get("io");

    if (io) {
      io.to(`institution:${institution}`).emit("enquiryCreated", { enquiry });

      const inst = await Institution.findById(institution).select("institutionAdmin");

      if (inst?.institutionAdmin) {
        const adminId = String(inst.institutionAdmin);

        io.to(`institutionAdmin:${adminId}`).emit("enquiryCreated", {
          enquiry,
          courseId: enquiry.courseId,
          listingType: enquiry.listingType,
        });

        const totalLeads = await getInstitutionAdminLeadsTotal(adminId);
        io.to(`institutionAdmin:${adminId}`).emit("institutionAdminTotalLeads", {
          totalLeads,
        });
      }
    }
  } catch (err) {
    console.error("EnquiriesController: create enquiry handler failed", err?.message || err);
  }

  res.status(201).json({
    success: true,
    data: enquiry,
  });
});


// New: summary by type in a range
exports.getInstitutionAdminEnquiryTypeSummary = asyncHandler(async (req, res, next) => {
  const range = (req.query.range || 'weekly').toString().toLowerCase();
  const { startDate, endDate } = getPeriod(range);
  const { callbacks, demos } = await countByTypeInRange(req.userId, startDate, endDate);
  res.status(200).json({ success: true, data: { range, callbacks, demos } });
});

// Rollup-based range summary from Institution.callbackRollups/demoRollups
exports.getInstitutionAdminEnquiryTypeByRangeRollups = asyncHandler(async (req, res, next) => {
  const range = (req.query.range || 'weekly').toString().toLowerCase();
  const type = (req.query.type || '').toString().toLowerCase();
  if (type && !['callback', 'demo'].includes(type)) return next(new AppError('Invalid type. Use type=callback|demo', 400));
  const { startDate, endDate } = getPeriod(range);
  const startKey = startDate.toISOString().split('T')[0];
  const endKey = endDate.toISOString().split('T')[0];
  const institutions = await Institution.find({ institutionAdmin: req.userId }).select('_id');
  const ids = institutions.map(i => i._id);
  if (ids.length === 0) return res.status(200).json({ success: true, data: { callbacks: 0, demos: 0 } });

  const doSum = async (field) => {
    const agg = await Institution.aggregate([
      { $match: { _id: { $in: ids } } },
      { $unwind: { path: `$${field}`, preserveNullAndEmptyArrays: false } },
      { $match: { [`${field}.day`]: { $gte: startKey, $lte: endKey } } },
      { $group: { _id: null, total: { $sum: `$${field}.count` } } }
    ]);
    return agg[0]?.total || 0;
  };

  if (type) {
    const total = await doSum(type === 'callback' ? 'callbackRollups' : 'demoRollups');
    return res.status(200).json({ success: true, data: { [type + 's']: total } });
  }

  const [callbacks, demos] = await Promise.all([
    doSum('callbackRollups'),
    doSum('demoRollups')
  ]);
  return res.status(200).json({ success: true, data: { callbacks, demos } });
});
