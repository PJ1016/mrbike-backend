var express = require('express');
var multer = require('multer');
var fs = require('fs-extra');
const router = express.Router();
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
    updateBookingStatus,
    verifyBookingOTP,
    sendBookingOTP,
    updatePickupStatus,
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

router.post('/addbooking/:id',addbooking)

// By Prashant 
router.get('/getallbookings',getallbookings)


router.get('/getuserbookings/:user_id',getuserbookings)
router.get('/getbooking/:id',getbooking)
router.delete('/deletebooking',deletebooking)
router.put('/updatebooking/:id',updateBookings)
router.post('/createBooking',createBooking)
router.get('/getBookingDetails/:id',getBookingDetails)
router.post('/updateBooking',updateBooking)
router.post('/updateBookingStatus/:bookingId/status',updateBookingStatus)
router.post('/sendBookingOTP',sendBookingOTP)
router.post('/sendBookingMobile',sendOtpToMobile)
router.post('/verifyBookingOTP',verifyBookingOTP)
router.post('/verifyBookingMobile',verifyOtpForMobile)
router.post("/update-pickup-status", updatePickupStatus);
router.post('/addNote', addNoteToBooking);
router.get('/getNotes/:bookingId', getNotesFromBooking);
router.put('/updateNote', updateNoteInBooking);
router.post('/deleteNote', deleteNoteFromBooking);
router.post('/cancelBooking/:bookingId', cancelBooking);
router.get('/getBookingTimerStatus/:bookingId', getBookingTimerStatus);
router.post('/:bookingId/service-complete', serviceComplete);
router.post('/:bookingId/select-payment-method', selectPaymentMethod);
router.post('/:bookingId/confirm-cash-received', confirmCashReceived);
router.post('/verify-delivery-otp', verifyDeliveryOtp);
router.post('/:bookingId/regenerate-delivery-otp', regenerateDeliveryOtp);

router.get("notification/:receiverId", getNotificationsByReceiverId);
// router.put('/updateBookingStatus/:booking_id', updateBookingStatusDealer);

module.exports = router;
