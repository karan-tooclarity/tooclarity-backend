const { Institution } = require("../models/Institution");
const Course = require("../models/Course");
const Branch = require("../models/Branch");
const InstituteAdmin = require("../models/InstituteAdmin");
const AppError = require("../utils/appError");

/**
 * Fetches and structures the full dataset for a given user.
 * This is the reusable business logic.
 * @param {string} userId - The ID of the user whose data to fetch.
 * @returns {Promise<object>} The fully structured data object.
 */
async function getFullStructuredData(userId) {
  console.log(`➡️ [Service] Starting full data fetch for userId: ${userId}`);

  // 1. Find the admin and their institution
  const admin = await InstituteAdmin.findById(userId).populate('institution').lean();
  if (!admin || !admin.institution) {
    console.log("❌ [Service] - No institution found for this admin.");
    // In a service, it's good practice to throw an error
    throw new AppError("No institution found for this user.", 404);
  }
  const institution = admin.institution;
  console.log(`✅ [Service] - Found institution: ${institution.instituteName}`);

  // 2. Find all branches
  const branches = await Branch.find({ institution: institution._id }).lean();
  console.log(`✅ [Service] - Found ${branches.length} branches.`);

  // 3. Group courses by branch
  const branchesWithCourses = await Promise.all(
    branches.map(async (branch) => {
      const courses = await Course.find({ branch: branch._id }).lean();
      return { ...branch, courses };
    })
  );

  // 4. Assemble and return the final object
  const finalExportData = {
    institution,
    branchesWithCourses,
    exportedAt: new Date().toISOString(),
  };

  console.log("✅ [Service] - Successfully assembled the final data object.");
  return finalExportData;
}

module.exports = {
  getFullStructuredData,
};