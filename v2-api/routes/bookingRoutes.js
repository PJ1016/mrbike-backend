const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");

// DEPRECATED — confirmed unused by User App, Dealer App and Admin UI.
// POST / returns 410 Gone (see controllers/bookingController.js#createBooking).
// Live booking creation is POST /bikedoctor/bookings/createBooking.
router.post("/", bookingController.createBooking);
router.get("/user/:userId", bookingController.getUserBookings);
router.post("/verify-otp", bookingController.verifyOtp);
router.patch("/:bookingId/status", bookingController.updateBookingStatus);
router.get("/:bookingId", bookingController.getBookingDetails);

module.exports = router;
