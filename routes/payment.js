const express = require('express');
const router = express.Router();
const { getAllPayments,getBillByBookingId,getUserBillsSimple,getUserBillDetails,getAllBills, initiatePayment, getPaymentById, paymentWebhook, createCheckoutUrl, createCheckoutSession, createPaymentLink } = require("../controller/payment");

router.post("/initiate", initiatePayment);
router.post("/create-checkout", createCheckoutUrl);
router.post('/create-checkout-session', createCheckoutSession);
router.post('/link', createPaymentLink);
router.get("/all-payments", getAllPayments);
router.get("/single-payment-detail/:id", getPaymentById);
router.get("/webhook", paymentWebhook);
router.get('/bills/booking/:booking_id', getBillByBookingId);
router.get('/bills/all', getAllBills);
router.get('/user/:user_id/bills/simple', getUserBillsSimple);
router.get('/user/:user_id/bills/:bill_id', getUserBillDetails);

module.exports = router;

// const express = require('express');
// const router = express.Router();
// const {
//     createPaymentOrder,
//     verifyPayment,
//     paymentWebhook,
//     getPaymentDetails,
//     initiateRefund,
//       getAllPayments
// } = require('../controller/payment');

// // Payment routes
// router.post('/create-order', createPaymentOrder);
// router.get('/verify/:order_id', verifyPayment);
// router.post('/webhook', paymentWebhook);
// router.get('/details/:id', getPaymentDetails);
// router.post('/refund', initiateRefund);
// router.get("/all-payments", getAllPayments);

// module.exports = router;