const Vendor = require("../models/dealerModel");
const Wallet = require("../models/Wallet_modal");
const Booking = require("../models/Booking");

/**
 * Settle dealer wallet for a completed booking.
 *
 * Pricing (customerTotal/commissionRate/commissionAmount/dealerEarnings) is
 * read from the booking's immutable pricing snapshot — see
 * services/pricingEngine.js — not recomputed from the dealer's current
 * settings. Falls back to recomputing from Booking.totalBill/tax and the
 * dealer's current commission for bookings created before that snapshot
 * existed.
 *
 * ONLINE: Platform received payment → credit dealer the Dealer Earnings.
 * CASH:   Dealer received cash (the full Customer Total) → debit dealer
 *         the Commission owed to the platform, leaving them with Dealer Earnings.
 *
 * Idempotent: booking.walletSettled flag prevents running twice.
 *
 * @param {string|ObjectId} bookingId
 * @param {'ONLINE'|'CASH'} paymentMethod
 * @returns {object|null} settlement summary, or null if already settled
 */
async function settleBookingWallet(bookingId, paymentMethod) {
  const bookingDoc = await Booking.findById(bookingId);
  if (!bookingDoc) throw new Error(`Booking not found: ${bookingId}`);

  // Idempotency guard — prevents duplicate settlement
  if (bookingDoc.walletSettled) return null;

  const dealer = await Vendor.findById(bookingDoc.dealer_id);
  if (!dealer) throw new Error(`Dealer not found for booking: ${bookingId}`);

  // Use the immutable pricing snapshot taken at booking creation
  // (services/pricingEngine.js via controller/booking.js#createBooking) —
  // never the dealer's *current* commission/tax, which may have changed
  // since this booking was placed. Bookings created before this snapshot
  // existed (no pricingVersion) fall back to the legacy recompute-from-
  // current-dealer-settings path for backward compatibility.
  //
  // Detection is `pricingVersion` presence ONLY — never
  // `parseFloat(field) || fallback` on the individual fields, since a
  // legitimately-zero value would then wrongly fall through to a recompute.
  const hasPricingSnapshot = Boolean(bookingDoc.pricingVersion);

  let orderAmount, taxAmount, customerTotal, commissionRate, commissionAmount, dealerEarnings;

  if (hasPricingSnapshot) {
    orderAmount = Number(bookingDoc.totalBill); // Subtotal (service + pickup + drop)
    taxAmount = Number(bookingDoc.tax);
    customerTotal = Number(bookingDoc.customerTotal);
    commissionRate = Number(bookingDoc.commissionRate);
    commissionAmount = Number(bookingDoc.commissionAmount);
    dealerEarnings = Number(bookingDoc.dealerEarnings);
  } else {
    orderAmount = parseFloat(bookingDoc.totalBill) || 0;
    taxAmount = parseFloat(bookingDoc.tax) || 0;
    customerTotal = parseFloat((orderAmount + taxAmount).toFixed(2));
    commissionRate = parseFloat(dealer.commission) || 0;
    commissionAmount = parseFloat(((commissionRate / 100) * orderAmount).toFixed(2));
    dealerEarnings = parseFloat((customerTotal - commissionAmount).toFixed(2));
  }

  const preBalance = parseFloat(dealer.wallet) || 0;

  let txnAmount;
  let txnType;
  let newBalance;
  let note;

  if (paymentMethod === "ONLINE") {
    // Platform received payment — credit dealer their earnings
    txnAmount = dealerEarnings;
    newBalance = parseFloat((preBalance + txnAmount).toFixed(2));
    txnType = "Credit";
    note = `Online settlement | Customer Total ₹${customerTotal} | Commission ${commissionRate}% of ₹${orderAmount} = ₹${commissionAmount} | Net credit ₹${txnAmount}`;
  } else if (paymentMethod === "CASH") {
    // Dealer collected cash — debit the commission owed to platform
    txnAmount = commissionAmount;
    newBalance = parseFloat((preBalance - txnAmount).toFixed(2));
    txnType = "Debit";
    note = `Cash commission | Customer Total ₹${customerTotal} | Commission ${commissionRate}% of ₹${orderAmount} = ₹${txnAmount}`;
  } else {
    throw new Error(`Unknown paymentMethod: ${paymentMethod}`);
  }

  // Zero-amount transactions are skipped but booking is still marked settled
  if (txnAmount > 0) {
    dealer.wallet = newBalance;
    await dealer.save();

    await Wallet.create({
      orderId: bookingDoc.bookingId || bookingDoc._id.toString(),
      dealer_id: dealer._id,
      booking_id: bookingDoc._id,
      Amount: txnAmount,
      Type: txnType,
      Note: note,
      Total: newBalance,
      pre_balance: preBalance,
      order_status: "APPROVED",
      transaction_type: paymentMethod === "ONLINE" ? "settlement_online" : "settlement_cash",
    });
  }

  // Mark booking as settled so this function never runs again for the same booking
  await Booking.findByIdAndUpdate(bookingId, { walletSettled: true });

  return {
    paymentMethod,
    txnType,
    orderAmount,
    taxAmount,
    customerTotal,
    commissionRate,
    commissionAmount,
    dealerEarnings,
    txnAmount,
    preBalance,
    newBalance,
  };
}

module.exports = { settleBookingWallet };
