const express = require("express");
const router = express.Router();

const {
  getInstitutionAdminLeadsSummary,
  getInstitutionAdminEnquiriesForChart,
  getInstitutionAdminRecentEnquiries,
  getInstitutionAdminStudents,
  createEnquiry,
  getInstitutionAdminEnquiryTypeSummary,
  getInstitutionAdminEnquiryTypeByRangeRollups,
  updateEnquiryStatus,
  getStudentsByEnquiryInstitution
} = require("../controllers/enquiries.controller");

// All routes require authentication


// Get total leads for institutionAdmin
router.get("/summary/leads", getInstitutionAdminLeadsSummary);

// Get enquiries data for chart (monthly by year)
router.get("/chart", getInstitutionAdminEnquiriesForChart);

// Get recent enquiries for dashboard
router.get("/recent", getInstitutionAdminRecentEnquiries);



// Summary by type for a time range
router.get("/summary/types", getInstitutionAdminEnquiryTypeSummary);

// Rollup-based range summary from Institution.callbackRollups/demoRollups
router.get("/summary/types/range", getInstitutionAdminEnquiryTypeByRangeRollups);

// Create new enquiry
router.post("/createEnquiry", createEnquiry);

// Update enquiry status
router.put("/:enquiryId/status", updateEnquiryStatus);

module.exports = router;
