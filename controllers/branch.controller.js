const Branch = require("../models/Branch");
const { Institution } = require("../models/Institution");
const AppError = require("../utils/appError");
const asyncHandler = require("express-async-handler");

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

exports.createBranch = asyncHandler(async (req, res, next) => {
  try {
    const { institutionId } = req.params; // Institution ID from route params
    const userId = req.userId; // Extracted from middleware

    console.log("🔐 Auth Info:", {
      institutionId,
      userId,
    });

    // 1Ensure the user owns the institution
    const institution = await checkOwnership(institutionId, userId);

    if (!institution) {
      console.warn(
        "🚫 Unauthorized access attempt:",
        JSON.stringify({ institutionId, userId }, null, 2),
      );
      return next(new AppError("Institution not found or unauthorized", 403));
    }

    // 2️⃣ Extract branches payload
    const { branches } = req.body;

    if (!branches || !Array.isArray(branches) || branches.length === 0) {
      console.warn("⚠️ No valid branches received in request body");
      return next(new AppError("No branches provided", 400));
    }

    console.log(
      "📥 Incoming branches payload:",
      JSON.stringify(branches, null, 2),
    );

    // 3️⃣ Add institution reference to each branch
    const branchesWithInstitution = branches.map((branch) => ({
      ...branch,
      institution: institutionId,
    }));

    console.log(
      "🔗 Branches after attaching institutionId:",
      JSON.stringify(branchesWithInstitution, null, 2),
    );

    // 4️⃣ Bulk create branches
    const createdBranches = await Branch.insertMany(branchesWithInstitution);

    console.log(
      "✅ Successfully created branches in DB:",
      JSON.stringify(
        createdBranches.map((b) => ({
          id: b._id,
          name: b.name || "Unnamed Branch",
          institution: b.institution,
        })),
        null,
        2,
      ),
    );

    // 5️⃣ Send response
    res.status(201).json({
      success: true,
      count: createdBranches.length,
      data: createdBranches,
    });
  } catch (err) {
    console.error("❌ Error in createBranch:", {
      message: err.message,
      stack: err.stack,
    });
    next(err);
  }
});

exports.getAllBranchesForInstitution = asyncHandler(async (req, res, next) => {
  const { institutionId } = req.params;
  const limit = parseInt(req.query.limit, 10) || 10;
  const cursor = req.query.cursor;
  await checkOwnership(institutionId, req.userId);
  const query = { institution: institutionId };
  if (cursor) {
    query._id = { $lt: cursor };
  }
  const branches = await Branch.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1);

  const hasNextPage = branches.length > limit;
  const data = hasNextPage ? branches.slice(0, limit) : branches;
  const nextCursor = hasNextPage ? data[data.length - 1]._id : null;
  res.status(200).json({
    success: true,
    count: data.length,
    data: data,
    nextCursor,
  });
});

exports.getBranchById = asyncHandler(async (req, res, next) => {
  const { institutionId, branchId } = req.params;

  await checkOwnership(institutionId, req.userId);

  const branch = await Branch.findById(branchId);

  if (!branch || branch.institution.toString() !== institutionId) {
    return next(
      new AppError(
        "Branch not found or does not belong to this institution",
        404,
      ),
    );
  }

  res.status(200).json({
    success: true,
    data: branch,
  });
});

exports.updateBranch = asyncHandler(async (req, res, next) => {
  const { institutionId, branchId } = req.params;

  await checkOwnership(institutionId, req.userId);

  let branch = await Branch.findById(branchId);

  if (!branch || branch.institution.toString() !== institutionId) {
    return next(
      new AppError(
        "Branch not found or does not belong to this institution",
        404,
      ),
    );
  }

  branch = await Branch.findByIdAndUpdate(branchId, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: branch,
  });
});

// @desc    Delete a branch
// @route   DELETE /api/v1/institutions/:institutionId/branches/:branchId
// @access  Private
exports.deleteBranch = asyncHandler(async (req, res, next) => {
  const { institutionId, branchId } = req.params;

  // Authorization Check
  await checkOwnership(institutionId, req.userId);

  const branch = await Branch.findById(branchId);

  if (!branch || branch.institution.toString() !== institutionId) {
    return next(
      new AppError(
        "Branch not found or does not belong to this institution",
        404,
      ),
    );
  }

  await branch.deleteOne();

  res.status(204).json({
    success: true,
    data: {},
  });
});
