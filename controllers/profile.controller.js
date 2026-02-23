const mongoose = require('mongoose');
const { addCourseToWishlistJob } = require('../jobs/wishlist.job');
const InstituteAdmin = require("../models/InstituteAdmin");

exports.getProfile = async (req, res, next) => {
  try {
    const pipeline = [
      { $match: { _id: new mongoose.Types.ObjectId(req.userId) } },

      {
        $project: {
          name: 1,
          email: 1,
          contactNumber: 1,
          institution: 1,
          role: 1,
          isProfileCompleted: 1,
          isPaymentDone: 1,
          googleId: 1,
          ProfilePicture: 1,
          address: 1,
          birthday: 1,
          isPhoneVerified: 1,
          isEmailVerified: 1,
        }
      },

      // lookup only if role == STUDENT
      {
        $lookup: {
          from: "userstats",
          let: { userId: "$_id", userRole: "$role" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$userId", "$$userId"] },
                    { $eq: ["$$userRole", "STUDENT"] }
                  ]
                }
              }
            }
          ],
          as: "stats"
        }
      },

      { $unwind: { path: "$stats", preserveNullAndEmptyArrays: true } },

      // Conditional projection: add stats only for STUDENT
      {
        $project: {
          name: 1,
          email: 1,
          contactNumber: 1,
          institution: 1,
          role: 1,
          isProfileCompleted: 1,
          isPaymentDone: 1,
          googleId: 1,
          ProfilePicture: 1,
          address: 1,
          birthday: 1,
          isPhoneVerified: 1,
          isEmailVerified: 1,

          // add fields ONLY if role == STUDENT
          callRequestCount: {
            $cond: {
              if: { $eq: ["$role", "STUDENT"] },
              then: "$stats.callRequestCount",
              else: "$$REMOVE"
            }
          },
          wishlistCount: {
            $cond: {
              if: { $eq: ["$role", "STUDENT"] },
              then: "$stats.wishlistCount",
              else: "$$REMOVE"
            }
          },
          requestDemoCount: {
            $cond: {
              if: { $eq: ["$role", "STUDENT"] },
              then: "$stats.requestDemoCount",
              else: "$$REMOVE"
            }
          }
        }
      }
    ];

    const result = await InstituteAdmin.aggregate(pipeline);
    const user = result[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed. User no longer exists."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: user
    });

  } catch (error) {
    next(error);
  }
};


/**
 * @description Queues a request to add a course to a student's wishlist.
 *              Responds immediately with 202 Accepted.
 */
exports.addToWishlist = async (req, res, next) => {
    const { courseId } = req.body;
    const userId = req.userId;
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
        return res.status(400).json({
            success: false,
            message: 'A valid courseId is required.',
        });
    }

    try {
        await addCourseToWishlistJob(userId, courseId);

        return res.status(202).json({
            success: true,
            message: 'Your request to add the course is being processed.',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @description Fetches the student's current wishlist.
 */
exports.getWishlist = async (req, res, next) => {
    try {
        const userWithWishlist = await InstituteAdmin.findById(req.userId)
            .select('wishlist name email')
            .populate({
                path: 'wishlist',
                select: 'title description instructor'
            });

        if (!userWithWishlist) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        return res.status(200).json({
            success: true,
            data: userWithWishlist.wishlist,
        });
    } catch (error) {
        next(error);
    }
}