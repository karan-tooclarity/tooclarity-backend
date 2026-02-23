const KindergartenCourse = require("../models/courses/KindergartenCourse");
const SchoolCourse = require("../models/courses/SchoolCourse");
const IntermediateCourse = require("../models/courses/IntermediateCourse");
const UgPgCourse = require("../models/courses/UgPgCourse");
const ExamPrepCourse = require("../models/courses/ExamPrepCourse");
const UpskillingCourse = require("../models/courses/UpskillingCourse");
const TutionCenterCourse = require("../models/courses/TutionCenterCourse");
const StudyAbroadCourse = require("../models/courses/StudyAbroadCourse");

const COURSE_MODEL_MAP = {
  UPSKILLING: UpskillingCourse,
  UG_PG: UgPgCourse,
  TUTION_CENTER: TutionCenterCourse,
  STUDY_ABROAD: StudyAbroadCourse,
  SCHOOL: SchoolCourse,
  KINDERGARTEN: KindergartenCourse,
  INTERMEDIATE: IntermediateCourse,
  EXAM_PREP: ExamPrepCourse,
};

module.exports = COURSE_MODEL_MAP;
