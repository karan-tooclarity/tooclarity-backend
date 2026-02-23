const express = require('express');
const router = express.Router();
const { googleAuthCallback } = require("../controllers/google.auth.controller");

router.get("/callback", googleAuthCallback);

module.exports = router;