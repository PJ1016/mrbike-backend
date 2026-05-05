const express = require("express");
const router = express.Router();

const bookingRoutes = require("./bookingRoutes");
const bannerRoutes = require("./bannerRoutes");

router.use("/bookings", bookingRoutes);
router.use("/banners", bannerRoutes);

module.exports = router;
