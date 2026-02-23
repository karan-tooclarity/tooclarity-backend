const mongoose = require("mongoose");
const InstitutionAdmin = require("../models/InstituteAdmin");
const asyncHandler = require("express-async-handler");

exports.getInstitutionAnalytics = asyncHandler(async (req, res) => {
  const {
    type,
    views = false,
    leads = false,
    callbackRequest = false,
    bookDemoRequest = false
  } = req.body;

  const userId = req.userId;

  if (!["weekly", "monthly", "yearly"].includes(type)) {
    return res.status(400).json({
      success: false,
      message: "Invalid analytics type",
    });
  }

  // ---------------------------
  // Date Range Logic
  // ---------------------------
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let groupFormat = "%Y-%m-%d";
  let rangeStart = new Date(today);

  if (type === "weekly") rangeStart.setDate(today.getDate() - 7);

  if (type === "monthly") {
    groupFormat = "%Y-%m";
    rangeStart.setMonth(today.getMonth() - 1);
  }

  if (type === "yearly") {
    groupFormat = "%Y-%m";
    rangeStart.setFullYear(today.getFullYear() - 1);
  }

  // ---------------------------
  // SINGLE AGGREGATION (your structure)
  // ---------------------------
  const result = await InstitutionAdmin.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(userId) } },
    { $limit: 1 },

    {
      $lookup: {
        from: "analyticsdailies",
        localField: "institution",
        foreignField: "institutionId",
        as: "analytics"
      }
    },

    {
      $project: {
        analytics: {
          $filter: {
            input: "$analytics",
            as: "a",
            cond: {
              $and: [
                { $gte: ["$$a.day", rangeStart] },
                { $lte: ["$$a.day", today] }
              ]
            }
          }
        }
      }
    },

    {
      $facet: {
        totals: [
          { $unwind: "$analytics" },
          {
            $group: {
              _id: null,
              views: { $sum: "$analytics.views" },
              leads: { $sum: "$analytics.leads" },
              callbackRequest: { $sum: "$analytics.callbackRequest" },
              bookDemoRequest: { $sum: "$analytics.bookDemoRequest" }
            }
          }
        ],

        viewsTimeline: views
          ? [
            { $unwind: "$analytics" },
            {
              $group: {
                _id: {
                  label: { $dateToString: { format: groupFormat, date: "$analytics.day" } }
                },
                count: { $sum: "$analytics.views" }
              }
            },
            { $project: { _id: 0, label: "$_id.label", count: 1 } },
            { $sort: { label: 1 } }
          ]
          : [],

        leadsTimeline: leads
          ? [
            { $unwind: "$analytics" },
            {
              $group: {
                _id: {
                  label: { $dateToString: { format: groupFormat, date: "$analytics.day" } }
                },
                count: { $sum: "$analytics.leads" }
              }
            },
            { $project: { _id: 0, label: "$_id.label", count: 1 } },
            { $sort: { label: 1 } }
          ]
          : [],

        callbackTimeline: callbackRequest
          ? [
            { $unwind: "$analytics" },
            {
              $group: {
                _id: {
                  label: { $dateToString: { format: groupFormat, date: "$analytics.day" } }
                },
                count: { $sum: "$analytics.callbackRequest" }
              }
            },
            { $project: { _id: 0, label: "$_id.label", count: 1 } },
            { $sort: { label: 1 } }
          ]
          : [],

        demoTimeline: bookDemoRequest
          ? [
            { $unwind: "$analytics" },
            {
              $group: {
                _id: {
                  label: { $dateToString: { format: groupFormat, date: "$analytics.day" } }
                },
                count: { $sum: "$analytics.bookDemoRequest" }
              }
            },
            { $project: { _id: 0, label: "$_id.label", count: 1 } },
            { $sort: { label: 1 } }
          ]
          : []
      }
    }
  ]);

  if (!result.length) {
    return res.status(404).json({
      success: false,
      message: "Institution not found for this admin",
    });
  }

  const { totals, viewsTimeline, leadsTimeline, callbackTimeline, demoTimeline } =
    result[0];

  const totalData =
    totals.length > 0
      ? totals[0]
      : { views: 0, leads: 0, callbackRequest: 0, bookDemoRequest: 0 };

  // ---------------------------
  // Build Response Dynamically
  // ---------------------------
  const response = {
    success: true,
    type,
    dateRange: {
      from: rangeStart.toISOString().split("T")[0],
      to: today.toISOString().split("T")[0]
    },
    totals: totalData,
    timelines: {}
  };

  if (views) response.timelines.views = viewsTimeline;
  if (leads) response.timelines.leads = leadsTimeline;
  if (callbackRequest) response.timelines.callbackRequest = callbackTimeline;
  if (bookDemoRequest) response.timelines.bookDemoRequest = demoTimeline;

  return res.status(200).json(response);
});
