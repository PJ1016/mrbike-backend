const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");

router.post("/", bookingController.createBooking);
router.get("/user/:userId", bookingController.getUserBookings);
router.post("/verify-otp", bookingController.verifyOtp);
router.patch("/:bookingId/status", bookingController.updateBookingStatus);
router.get("/:bookingId", bookingController.getBookingDetails);

module.exports = router;
