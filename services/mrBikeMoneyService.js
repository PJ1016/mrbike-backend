const Customer = require("../models/customer_model");
const MrBikeMoneyTransaction = require("../models/MrBikeMoneyTransaction");
const { round2 } = require("./pricingEngine");

function calculateMrBikeMoneyRedemption({ balance, serviceLimit, amountDueBeforeMoney, requestedAmount }) {
  const available = Math.max(0, round2(Number(balance) || 0));
  const limit = Math.max(0, round2(Number(serviceLimit) || 0));
  const due = Math.max(0, round2(Number(amountDueBeforeMoney) || 0));
  const maxRedeemable = round2(Math.min(available, limit, due));

  if (requestedAmount === undefined || requestedAmount === null || requestedAmount === "") {
    return { balance: available, serviceLimit: limit, maxRedeemable, amountToUse: 0 };
  }

  const requested = Number(requestedAmount);
  if (!Number.isFinite(requested) || requested < 0) {
    const error = new Error("MR Bike Money amount must be a non-negative number");
    error.code = "INVALID_MR_BIKE_MONEY_AMOUNT";
    throw error;
  }

  return {
    balance: available,
    serviceLimit: limit,
    maxRedeemable,
    amountToUse: round2(Math.min(requested, maxRedeemable)),
  };
}

function getServiceRedemptionLimit(serviceDocs) {
  return round2((serviceDocs || []).reduce((total, service) => {
    const base = service?.base_service_id;
    return total + Math.max(0, Number(base?.mrBikeMoneyMaxRedeem) || 0);
  }, 0));
}

async function debitForBooking({ userId, bookingId, amount }) {
  const debit = round2(Number(amount) || 0);
  if (debit <= 0) return null;

  const updated = await Customer.findOneAndUpdate(
    { _id: userId, mrBikeMoneyBalance: { $gte: debit } },
    { $inc: { mrBikeMoneyBalance: -debit } },
    { new: true }
  );
  if (!updated) {
    const error = new Error("MR Bike Money balance is no longer sufficient. Please refresh the price.");
    error.code = "INSUFFICIENT_MR_BIKE_MONEY";
    throw error;
  }

  try {
    return await MrBikeMoneyTransaction.create({
      userId,
      bookingId,
      type: "debit",
      amount: debit,
      balanceAfter: updated.mrBikeMoneyBalance,
      description: "Used on service booking",
      idempotencyKey: `booking:${bookingId}:debit`,
    });
  } catch (error) {
    await Customer.updateOne({ _id: userId }, { $inc: { mrBikeMoneyBalance: debit } });
    throw error;
  }
}

async function refundBookingMoney(booking) {
  const amount = round2(Number(booking?.mrBikeMoneyUsed) || 0);
  if (!booking?._id || !booking?.user_id || amount <= 0) return null;

  const idempotencyKey = `booking:${booking._id}:refund`;
  if (await MrBikeMoneyTransaction.exists({ idempotencyKey })) return null;

  const updated = await Customer.findByIdAndUpdate(
    booking.user_id,
    { $inc: { mrBikeMoneyBalance: amount } },
    { new: true }
  );
  if (!updated) return null;

  try {
    return await MrBikeMoneyTransaction.create({
      userId: booking.user_id,
      bookingId: booking._id,
      type: "refund",
      amount,
      balanceAfter: updated.mrBikeMoneyBalance,
      description: "Refund for cancelled, rejected or expired booking",
      idempotencyKey,
    });
  } catch (error) {
    if (error.code === 11000) {
      // Another request won the idempotency race. Undo only this request's
      // increment, leaving the winning refund intact.
      await Customer.updateOne({ _id: booking.user_id }, { $inc: { mrBikeMoneyBalance: -amount } });
      return null;
    }
    await Customer.updateOne({ _id: booking.user_id }, { $inc: { mrBikeMoneyBalance: -amount } });
    throw error;
  }
}

module.exports = {
  calculateMrBikeMoneyRedemption,
  getServiceRedemptionLimit,
  debitForBooking,
  refundBookingMoney,
};
