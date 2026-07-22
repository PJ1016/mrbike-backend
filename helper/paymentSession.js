const Payment = require("../models/Payment");

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
  const result = await Payment.updateMany(
    { booking_id: bookingId, order_status: "PENDING" },
    {
      $set: {
        order_status: "CANCELLED",
        "metadata.cancelled_at": new Date(),
        "metadata.cancelled_reason": "payment_method_changed",
      },
    },
  );
  return result.modifiedCount || 0;
}

module.exports = { cancelPendingPaymentSessions };
