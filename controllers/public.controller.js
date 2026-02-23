const Course = require("../models/Course");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const RedisUtil = require("../utils/redis.util");

exports.getAllVisibleCourses = asyncHandler(async (req, res, next) => {
  try {
    // FIX: get user ID safely
    const rawUserId = req.userId;
    const userObjectId = new mongoose.Types.ObjectId(rawUserId);

    const courses = await Course.aggregate([
      // Only active courses
      {
        $match: {
          status: "Active",
        },
      },

      // Lookup institution details
      {
        $lookup: {
          from: "institutions",
          localField: "institution",
          foreignField: "_id",
          as: "institutionDetails",
        },
      },
      { $unwind: "$institutionDetails" },

      // Check wishlist status for this user
      {
        $lookup: {
          from: "wishlists",
          let: { courseId: "$_id", userId: userObjectId },
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

      // Add isWishlisted boolean
      {
        $addFields: {
          isWishlisted: { $gt: [{ $size: "$wishlistEntry" }, 0] },
        },
      },

      // Select required fields
      {
        $project: {
          _id: 1,
          priceOfCourse: 1,
          courseDuration: 1,
          courseName: 1,
          imageUrl: 1,
          selectBranch: 1,

          "institutionDetails._id": 1,
          "institutionDetails.instituteName": 1,
          "institutionDetails.logoUrl": 1,
          "institutionDetails.locationURL": 1,

          isWishlisted: 1,
        },
      },
    ]);

    const impressionItems = courses.map((course) => ({
      courseId: course._id,
      institutionId: course.institutionDetails._id,
    }));

    // Track impressions for each course
    impressionItems.forEach((item) => {
      RedisUtil.trackUniqueCourseViewOrImpression(
        "leadImpression",
        item.courseId,
        item.institutionId,
        rawUserId
      );
    });

    res.status(200).json({ success: true, data: courses });
  } catch (error) {
    next(error);
  }
});
