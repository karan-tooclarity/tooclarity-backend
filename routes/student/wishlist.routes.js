const express = require('express');
const WishlistController = require('../../controllers/student/wishlist.controller');

const router = express.Router();

router.route('/')
    .get( WishlistController.getWishlistByUser)
    .post( WishlistController.addToWishlist);

module.exports = router;