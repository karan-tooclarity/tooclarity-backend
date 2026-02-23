// backend/routes/profile.routes.js
const express = require('express');
const router = express.Router();
const { getProfile, getWishlist, addToWishlist } = require('../controllers/profile.controller');

router.get('/profile', getProfile);
router.route('/wishlist')
    .get(getWishlist)
    .post(addToWishlist);

module.exports = router;