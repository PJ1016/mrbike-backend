const express = require('express');
const router = express.Router();
const { requireAdmin } = require("../middlewares/requireAdmin");
const { requireCustomer, requireOwnCustomerParam } = require("../middlewares/customerAuth");
const { requireBookingParticipant } = require("../middlewares/bookingAuth");
const { verifyDealerToken, requireOwnDealerBody } = require("../middlewares/dealerAuth");
const cashfreeWebhookSecurity = require("../middlewares/cashfreeWebhookSecurity");
const { getAllPayments,getBillByBookingId,getUserBillsSimple,getUserBillDetails,getAllBills, initiatePayment, getPaymentById, paymentWebhook, createCheckoutUrl, createCheckoutSession, createPaymentLink, createOrderForAdd } = require("../controller/payment");

router.post("/initiate", requireBookingParticipant(req => req.body.booking_id), initiatePayment);
router.post("/create-checkout", requireAdmin, createCheckoutUrl);
router.post('/create-checkout-session', requireAdmin, createCheckoutSession);
router.post('/link', requireAdmin, createPaymentLink);
router.post("/createOrderForAdd", verifyDealerToken, requireOwnDealerBody("dealer_id"), createOrderForAdd);
router.get("/all-payments", requireAdmin, getAllPayments);
router.get("/single-payment-detail/:id", requireAdmin, getPaymentById);
router.post("/webhook", cashfreeWebhookSecurity, paymentWebhook);
router.get('/bills/booking/:booking_id', requireBookingParticipant(req => req.params.booking_id), getBillByBookingId);
router.get('/bills/all', requireAdmin, getAllBills);
router.get('/user/:user_id/bills/simple', requireCustomer, requireOwnCustomerParam("user_id"), getUserBillsSimple);
router.get('/user/:user_id/bills/:bill_id', requireCustomer, requireOwnCustomerParam("user_id"), getUserBillDetails);

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
