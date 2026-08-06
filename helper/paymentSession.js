const Payment = require("../models/Payment");
const Booking = require("../models/Booking");
const axios = require("axios");
const crypto = require("crypto");

const CASHFREE_ORDERS_URL = "https://api.cashfree.com/pg/orders";
const ORDER_LOCK_MS = 60 * 1000;

const cashfreeHeaders = (idempotencyKey) => ({
  "x-client-id": process.env.CASHFREE_APP_ID,
  "x-client-secret": process.env.CASHFREE_SECRET_KEY,
  "x-api-version": process.env.CASHFREE_API_VERSION || "2023-08-01",
  "x-idempotency-key": idempotencyKey,
  "Content-Type": "application/json",
});

async function acquirePaymentOrderLock(bookingId) {
  const token = crypto.randomUUID();
  const now = new Date();
  const booking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      payment_status: { $ne: "completed" },
      $or: [
        { paymentOrderLockUntil: null },
        { paymentOrderLockUntil: { $exists: false } },
        { paymentOrderLockUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        paymentOrderLockToken: token,
        paymentOrderLockUntil: new Date(now.getTime() + ORDER_LOCK_MS),
      },
    },
    { new: true },
  ).select("+paymentOrderLockToken +paymentOrderLockUntil");

  if (!booking) {
    const error = new Error("A payment order is already being created or payment is complete");
    error.code = "PAYMENT_ORDER_LOCKED";
    throw error;
  }
  return token;
}

async function releasePaymentOrderLock(bookingId, token) {
  if (!token) return;
  await Booking.updateOne(
    { _id: bookingId, paymentOrderLockToken: token },
    { $unset: { paymentOrderLockToken: 1, paymentOrderLockUntil: 1 } },
  );
}

async function terminateCashfreeOrder(payment) {
  if (!payment?.orderId) return;
  const idempotencyHex = crypto
    .createHash("sha256")
    .update(`terminate:${payment.orderId}`)
    .digest("hex");
  const idempotencyKey = `${idempotencyHex.slice(0, 8)}-${idempotencyHex.slice(8, 12)}-4${idempotencyHex.slice(13, 16)}-a${idempotencyHex.slice(17, 20)}-${idempotencyHex.slice(20, 32)}`;

  let response;
  try {
    response = await axios.patch(
      `${CASHFREE_ORDERS_URL}/${encodeURIComponent(payment.orderId)}`,
      { order_status: "TERMINATED" },
      { headers: cashfreeHeaders(idempotencyKey) },
    );
  } catch (error) {
    if (![409, 422].includes(error.response?.status)) throw error;
    response = await axios.get(
      `${CASHFREE_ORDERS_URL}/${encodeURIComponent(payment.orderId)}`,
      { headers: cashfreeHeaders(idempotencyKey) },
    );
  }

  if (response.data?.order_status === "PAID") {
    const error = new Error(`Cashfree order ${payment.orderId} is already paid`);
    error.code = "CASHFREE_ORDER_ALREADY_PAID";
    throw error;
  }
  if (!["TERMINATED", "TERMINATION_REQUESTED", "EXPIRED"].includes(response.data?.order_status)) {
    throw new Error(`Cashfree did not terminate order ${payment.orderId}`);
  }
}

/**
 * Cancel any still-PENDING Cashfree payment sessions for a booking.
 *
 * Called whenever the dealer (re)selects a payment method or generates a
 * fresh QR, so a stale/abandoned order can never be paid later and get
 * mistaken by the webhook for the customer's current, active session.
 * SUCCESS/FAILED/CANCELLED/EXPIRED payments are left untouched.
 *
 * @param {string|ObjectId} bookingId
 * @returns {number} how many pending sessions were cancelled
 */
async function cancelPendingPaymentSessions(bookingId) {
  const pendingPayments = await Payment.find({ booking_id: bookingId, order_status: "PENDING" });
  for (const payment of pendingPayments) {
    await terminateCashfreeOrder(payment);
    payment.order_status = "CANCELLED";
    payment.gateway_status = "TERMINATED";
    payment.metadata = {
      ...payment.metadata,
      cancelled_at: new Date(),
      cancelled_reason: "payment_method_changed",
      cashfree_termination_requested: true,
    };
    await payment.save();
  }
  return pendingPayments.length;
}

module.exports = {
  acquirePaymentOrderLock,
  releasePaymentOrderLock,
  terminateCashfreeOrder,
  cancelPendingPaymentSessions,
};
