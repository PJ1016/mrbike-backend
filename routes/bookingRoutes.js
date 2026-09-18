var express = require('express');
var multer = require('multer');
var fs = require('fs-extra');
const router = express.Router();
const { requireAdmin } = require("../middlewares/requireAdmin");
const { requireCustomer, requireOwnedBooking } = require("../middlewares/customerAuth");
const { requireBookingParticipant, requireOwnBookingList, requireActorRole, requireActorRoleAny } = require("../middlewares/bookingAuth");
const { getNotificationsByReceiverId } = require("../controller/notificationController");
const { 
    addbooking, 
    getallbookings, 
    getbooking, 
    deletebooking, 
    getuserbookings,
    createBooking,
    getBookingDetails,
    updateBooking,
    updateTowingCharge,
    updateBookingStatus,
    verifyBookingOTP,
    sendBookingOTP,
    updatePickupStatus,
    markCustomerArrived,
    deleteNoteFromBooking,
    updateNoteInBooking,
    getNotesFromBooking,
    addNoteToBooking,
    updateBookings,
    sendOtpToMobile,
    verifyOtpForMobile,
    cancelBooking,
    getBookingTimerStatus,
    serviceComplete,
    selectPaymentMethod,
    confirmCashReceived,
    verifyDeliveryOtp,
    regenerateDeliveryOtp,
    // updateBookingStatusDealer
} = require("../controller/booking")
const {
    startPickup,
    updatePickupLocation,
    markArrived,
    verifyPickupOtp,
    completeBikePickup,
} = require("../controller/pickupLifecycleController");

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        var path = `./upload/booking`;
        fs.mkdirsSync(path);
        callback(null, path);
    },
    filename(req, file, callback) {
        callback(null, Date.now() + '_' + file.originalname);
    },
});
const upload = multer({ storage });

router.post('/addbooking/:id', requireAdmin, addbooking)

// By Prashant 
router.get('/getallbookings', requireAdmin, getallbookings)


router.get('/getuserbookings/:user_id', requireOwnBookingList, getuserbookings)
router.get('/getbooking/:id', requireBookingParticipant(req => req.params.id), getbooking)
router.delete('/deletebooking', requireAdmin, deletebooking)
router.put('/updatebooking/:id', requireBookingParticipant(req => req.params.id), updateBookings)
router.post('/createBooking', requireCustomer, createBooking)
router.get('/getBookingDetails/:id', requireBookingParticipant(req => req.params.id), getBookingDetails)
router.post('/updateBooking', requireBookingParticipant(req => req.body.bookingId), updateBooking)
// Towing charge — dealer handling the booking or an admin, pre-payment only.
// Recomputes the whole pricing breakdown server-side; see controller/booking.js.
router.post('/:bookingId/towing-charge', requireBookingParticipant(req => req.params.bookingId), requireActorRoleAny("dealer", "admin"), updateTowingCharge)
router.post('/updateBookingStatus/:bookingId/status', requireBookingParticipant(req => req.params.bookingId), updateBookingStatus)
router.post('/sendBookingOTP', requireBookingParticipant(req => req.body.bookingId), requireActorRole("dealer"), sendBookingOTP)
router.post('/sendBookingMobile', requireBookingParticipant(req => req.body.bookingId), requireActorRole("dealer"), sendOtpToMobile)
router.post('/verifyBookingOTP', requireBookingParticipant(req => req.body.bookingId), requireActorRole("dealer"), verifyBookingOTP)
router.post('/verifyBookingMobile', requireBookingParticipant(req => req.body.bookingId), requireActorRole("dealer"), verifyOtpForMobile)
router.post("/update-pickup-status", requireBookingParticipant(req => req.body.bookingId), requireActorRole("dealer"), updatePickupStatus);
router.post('/:bookingId/customer-arrived', requireBookingParticipant(req => req.params.bookingId), requireActorRole("dealer"), markCustomerArrived);
// Authenticated dealer pickup lifecycle. Participant lookup deliberately
// returns 404 to a dealer who does not own the booking.
router.post('/:bookingId/pickup/start', requireBookingParticipant(req => req.params.bookingId), requireActorRole("dealer"), startPickup);
router.patch('/:bookingId/pickup/location', requireBookingParticipant(req => req.params.bookingId), requireActorRole("dealer"), updatePickupLocation);
router.post('/:bookingId/pickup/arrived', requireBookingParticipant(req => req.params.bookingId), requireActorRole("dealer"), markArrived);
router.post('/:bookingId/pickup/verify-otp', requireBookingParticipant(req => req.params.bookingId), requireActorRole("dealer"), verifyPickupOtp);
router.post('/:bookingId/pickup/complete', requireBookingParticipant(req => req.params.bookingId), requireActorRole("dealer"), completeBikePickup);
router.post('/addNote', requireBookingParticipant(req => req.body.bookingId), requireActorRole("dealer"), addNoteToBooking);
router.get('/getNotes/:bookingId', requireBookingParticipant(req => req.params.bookingId), getNotesFromBooking);
router.put('/updateNote', requireBookingParticipant(req => req.body.bookingId), requireActorRole("dealer"), updateNoteInBooking);
router.post('/deleteNote', requireBookingParticipant(req => req.body.bookingId), requireActorRole("dealer"), deleteNoteFromBooking);
router.post('/cancelBooking/:bookingId', requireCustomer, requireOwnedBooking("bookingId"), cancelBooking);
router.get('/getBookingTimerStatus/:bookingId', requireBookingParticipant(req => req.params.bookingId), getBookingTimerStatus);
router.post('/:bookingId/service-complete', requireBookingParticipant(req => req.params.bookingId), requireActorRole("dealer"), serviceComplete);
router.post('/:bookingId/select-payment-method', requireBookingParticipant(req => req.params.bookingId), requireActorRole("dealer"), selectPaymentMethod);
router.post('/:bookingId/confirm-cash-received', requireBookingParticipant(req => req.params.bookingId), requireActorRole("dealer"), confirmCashReceived);
router.post('/verify-delivery-otp', requireBookingParticipant(req => req.body.bookingId), requireActorRole("dealer"), verifyDeliveryOtp);
router.post('/:bookingId/regenerate-delivery-otp', requireBookingParticipant(req => req.params.bookingId), requireActorRole("dealer"), regenerateDeliveryOtp);

router.get("notification/:receiverId", getNotificationsByReceiverId);
// router.put('/updateBookingStatus/:booking_id', updateBookingStatusDealer);

module.exports = router;
