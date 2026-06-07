const Vendor = require("../models/dealerModel");
const Wallet = require("../models/Wallet_modal");
const Booking = require("../models/Booking");

/**
 * Settle dealer wallet for a completed booking.
 *
 * ONLINE: Platform received payment → credit dealer (order - commission).
 * CASH:   Dealer received cash     → debit dealer  (commission only).
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

  const orderAmount = parseFloat(bookingDoc.totalBill) || 0;
  const commissionRate = parseFloat(dealer.commission) || 0;
  const commissionAmount = parseFloat(((commissionRate / 100) * orderAmount).toFixed(2));

  const preBalance = parseFloat(dealer.wallet) || 0;

  let txnAmount;
  let txnType;
  let newBalance;
  let note;

  if (paymentMethod === "ONLINE") {
    // Platform received payment — credit dealer the net amount
    txnAmount = parseFloat((orderAmount - commissionAmount).toFixed(2));
    newBalance = parseFloat((preBalance + txnAmount).toFixed(2));
    txnType = "Credit";
    note = `Online settlement | Order ₹${orderAmount} | Commission ${commissionRate}% = ₹${commissionAmount} | Net credit ₹${txnAmount}`;
  } else if (paymentMethod === "CASH") {
    // Dealer collected cash — debit the commission owed to platform
    txnAmount = commissionAmount;
    newBalance = parseFloat((preBalance - txnAmount).toFixed(2));
    txnType = "Debit";
    note = `Cash commission | Order ₹${orderAmount} | Commission ${commissionRate}% = ₹${txnAmount}`;
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
    commissionRate,
    commissionAmount,
    txnAmount,
    preBalance,
    newBalance,
  };
}

module.exports = { settleBookingWallet };
