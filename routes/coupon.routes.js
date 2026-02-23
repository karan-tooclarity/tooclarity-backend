const express = require('express');
const { createCoupon, applyCoupon, listInstitutions } = require('../controllers/coupon.controller');

const couponAdminRoute = express.Router();
const couponInstitutionAdminRoute = express.Router();

couponAdminRoute.route('/create').post(createCoupon);
couponAdminRoute.route("/institutions").get(listInstitutions);
couponInstitutionAdminRoute.route('/apply-coupon').post(applyCoupon);

module.exports = {
    couponAdminRoute,
    couponInstitutionAdminRoute
}