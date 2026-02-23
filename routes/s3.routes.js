const express = require("express");
const { getUploadUrl, getPublicUrl } = require("../controllers/s3Controller")

const router = express.Router();

router.post("/upload-url", getUploadUrl);
router.get("/key", getPublicUrl)

module.exports = router;