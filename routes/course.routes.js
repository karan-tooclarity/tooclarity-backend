const express = require('express');
const courseController = require('../controllers/course.controller');
const { validateCourseCreation, validateCourseUpdate, validateL2Update} = require('../middleware/validators');
const { uploadCourseFiles } = require('../middleware/fileUpload.middleware'); 

const router = express.Router({ mergeParams: true });

router.route('/')
    .post(
        uploadCourseFiles,
        validateL2Update,
        courseController.createCourse
    )
    .get(courseController.getAllCoursesForInstitution);

router.route('/create')
    .post(
        courseController.createCourse
    )


router.get('/search', courseController.searchCourses);

router.get('/filter', courseController.filterCourses);

router.get('/summary/metrics/institution-admin', courseController.getInstitutionAdminMetricSummaryUnified);
router.get('/summary/metrics/institution-admin/range', courseController.getInstitutionAdminMetricByRangeUnified);
router.get('/summary/metrics/institution-admin/series', courseController.getInstitutionAdminMetricSeriesUnified);

router.post('/:courseId/metrics', courseController.incrementMetricUnified);

router.post("/enquiry", courseController.updateStatsAndCreateEnquiry)

router.route('/:courseId')
    .get(courseController.getCourseById)
    .put(
        uploadCourseFiles,
        // validateCourseUpdate,
        courseController.updateCourse
    )
    .delete(courseController.deleteCourse);

module.exports = router;