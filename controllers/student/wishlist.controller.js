const Wishlist = require('../../models/wishlist');
const UserStats = require("../../models/userStats");
const mongoose = require('mongoose');

exports.getWishlistByUser = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);

    const wishlist = await Wishlist.aggregate([
      // 1️⃣ Match all wishlist items for the given user
      { $match: { userId } },

      // 2️⃣ Lookup full course data
      {
        $lookup: {
          from: "courses",
          localField: "courseId",
          foreignField: "_id",
          as: "courseData"
        }
      },

      // 3️⃣ Unwind course data
      { $unwind: "$courseData" },

      // 4️⃣ Filter only ACTIVE courses
      {
        $match: {
          "courseData.status": "Active"
        }
      },

      // 5️⃣ Join institution details
      {
        $lookup: {
          from: "institutions",
          localField: "courseData.institution",
          foreignField: "_id",
          as: "institutionData"
        }
      },

      { $unwind: "$institutionData" },

      // 6️⃣ Final formatting according to DashboardCourse interface
      {
        $project: {
          _id: "$courseData._id",
          courseName: "$courseData.courseName",
          imageUrl: "$courseData.imageUrl",
          courseDuration: "$courseData.courseDuration",
          priceOfCourse: "$courseData.priceOfCourse",
          selectBranch: "$courseData.selectBranch",

          institutionDetails: {
            id: "$institutionData._id",
            instituteName: "$institutionData.instituteName",
            logoUrl: "$institutionData.logoUrl",
            locationURL: "$institutionData.locationURL"
          },
          isWishlisted: {
            $literal: true
          }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      count: wishlist.length,
      data: wishlist
    });

  } catch (error) {
    console.error("Error in getWishlistByUser:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};


exports.addToWishlist = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const { courseId, isWishlisted, institutionType } = req.body;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "courseId is required",
      });
    }

    const courseObjectId = new mongoose.Types.ObjectId(courseId);

    await session.withTransaction(async () => {
      if (isWishlisted === true) {
        await Wishlist.findOneAndUpdate(
          { userId, courseId: courseObjectId },
          { $setOnInsert: { userId, courseId: courseObjectId } },
          { upsert: true, new: true, session }
        );

        await UserStats.findOneAndUpdate(
          { userId },
          { $inc: { wishlistCount: 1 } },
          { upsert: true, new: true, session }
        );

      } else if (isWishlisted === false) {
        const deleted = await Wishlist.findOneAndDelete(
          { userId, courseId: courseObjectId },
          { session }
        );

        if (deleted) {
          await UserStats.findOneAndUpdate(
            { userId },
            { $inc: { wishlistCount: -1 } },
            { new: true, session }
          );
        }
      }
    });

    session.endSession();

    return res.status(200).json({
      success: true,
      message: isWishlisted ? "Added to wishlist" : "Removed from wishlist",
    });

  } catch (error) {
    session.endSession();
    console.error("Error in addToWishlist:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};