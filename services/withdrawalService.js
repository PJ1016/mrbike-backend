const mongoose = require("mongoose");
const Vendor = require("../models/dealerModel");
const Wallet = require("../models/Wallet_modal");

const MIN_REMAINING_BALANCE = 200;
const TRANSITIONS = {
  PENDING: ["IN_PROGRESS", "REJECTED"],
  IN_PROGRESS: ["APPROVED", "REJECTED"],
};

function transactionsUnsupported(error) {
  return /Transaction numbers are only allowed|replica set|mongos/i.test(error?.message || "");
}
function round2(value) { return Number(Number(value).toFixed(2)); }

async function createWithdrawalInternal({ dealerId, amount, note, performedBy, idempotencyKey }, session) {
  if (idempotencyKey) {
    const existing = await Wallet.findOne({ dealer_id: dealerId, idempotency_key: idempotencyKey }).session(session);
    if (existing) return { existing: true, wallet: existing };
  }
  const withdrawalAmount = round2(amount);
  const dealer = await Vendor.findOneAndUpdate(
    { _id: dealerId, wallet: { $gte: round2(withdrawalAmount + MIN_REMAINING_BALANCE) } },
    { $inc: { wallet: -withdrawalAmount } },
    { new: true, session },
  );
  if (!dealer) throw new Error("Insufficient balance: ₹200 minimum must remain after withdrawal");
  const [wallet] = await Wallet.create([{
    orderId: `WD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    dealer_id: dealer._id,
    Amount: withdrawalAmount,
    Type: "Debit",
    Note: note || `Withdrawal request of ₹${withdrawalAmount}`,
    Total: round2(dealer.wallet),
    pre_balance: round2(dealer.wallet + withdrawalAmount),
    order_status: "PENDING",
    transaction_type: "withdrawal",
    performed_by: performedBy,
    ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
  }], { session });
  return { existing: false, wallet };
}

async function createWithdrawalFallback(args) {
  let dealer = null;
  const amount = round2(args.amount);
  try {
    if (args.idempotencyKey) {
      const existing = await Wallet.findOne({ dealer_id: args.dealerId, idempotency_key: args.idempotencyKey });
      if (existing) return { existing: true, wallet: existing };
    }
    dealer = await Vendor.findOneAndUpdate(
      { _id: args.dealerId, wallet: { $gte: round2(amount + MIN_REMAINING_BALANCE) } },
      { $inc: { wallet: -amount } }, { new: true },
    );
    if (!dealer) throw new Error("Insufficient balance: ₹200 minimum must remain after withdrawal");
    const wallet = await Wallet.create({
      orderId: `WD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      dealer_id: dealer._id, Amount: amount, Type: "Debit",
      Note: args.note || `Withdrawal request of ₹${amount}`,
      Total: round2(dealer.wallet), pre_balance: round2(dealer.wallet + amount),
      order_status: "PENDING", transaction_type: "withdrawal", performed_by: args.performedBy,
      ...(args.idempotencyKey ? { idempotency_key: args.idempotencyKey } : {}),
    });
    return { existing: false, wallet };
  } catch (error) {
    // No safe automatic compensation is possible without knowing which row
    // was inserted. A duplicate client key is safely returned as the original.
    if (error?.code === 11000 && args.idempotencyKey) {
      const existing = await Wallet.findOne({ dealer_id: args.dealerId, idempotency_key: args.idempotencyKey });
      if (existing) return { existing: true, wallet: existing };
    }
    if (dealer) {
      const rollback = await Vendor.updateOne({ _id: dealer._id, wallet: dealer.wallet }, { $inc: { wallet: amount } });
      // Do not allow a retry to reserve twice if another writer made a safe
      // compensation impossible; the failure remains explicit for review.
      if (rollback.modifiedCount !== 1) throw error;
    }
    throw error;
  }
}

async function createWithdrawal(args) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await createWithdrawalInternal(args, session); });
    return result;
  } catch (error) {
    if (!transactionsUnsupported(error)) throw error;
    return createWithdrawalFallback(args);
  } finally { await session.endSession(); }
}

async function transitionWithdrawalInternal({ walletId, nextStatus, payoutReference }, session) {
  const allowed = Object.entries(TRANSITIONS)
    .filter(([, targets]) => targets.includes(nextStatus)).map(([from]) => from);
  if (!allowed.length) throw new Error("Invalid withdrawal status transition");

  const withdrawal = await Wallet.findOneAndUpdate(
    { _id: walletId, transaction_type: "withdrawal", order_status: { $in: allowed } },
    { $set: { order_status: nextStatus, ...(payoutReference ? { payout_reference: payoutReference } : {}) } },
    { new: true, session },
  );
  if (!withdrawal) throw new Error("Withdrawal not found or status transition is not allowed");

  if (nextStatus !== "REJECTED") return withdrawal;
  const dealer = await Vendor.findByIdAndUpdate(
    withdrawal.dealer_id,
    { $inc: { wallet: round2(withdrawal.Amount) } },
    { new: true, session },
  );
  if (!dealer) throw new Error("Withdrawal dealer not found");
  await Wallet.create([{
    orderId: `ROLLBACK-${withdrawal.orderId}`,
    dealer_id: withdrawal.dealer_id,
    Amount: round2(withdrawal.Amount),
    Type: "Credit",
    Note: `Withdrawal rejected: ${withdrawal.orderId}`,
    Total: round2(dealer.wallet),
    pre_balance: round2(dealer.wallet - withdrawal.Amount),
    order_status: "APPROVED",
    transaction_type: "rollback",
    rollback_of: withdrawal._id,
    performed_by: withdrawal.performed_by,
  }], { session });
  return withdrawal;
}

async function transitionWithdrawal({ walletId, nextStatus, payoutReference }) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await transitionWithdrawalInternal({ walletId, nextStatus, payoutReference }, session); });
    return result;
  } catch (error) {
    // Transition and reversal must be all-or-nothing. Without transactions,
    // only non-money status progression is safe; rejection is deliberately
    // refused rather than risking a duplicate restoration.
    if (!transactionsUnsupported(error)) throw error;
    if (nextStatus === "REJECTED") throw new Error("Withdrawal rejection requires transaction-capable MongoDB");
    const allowed = Object.entries(TRANSITIONS).filter(([, targets]) => targets.includes(nextStatus)).map(([from]) => from);
    const result = await Wallet.findOneAndUpdate({ _id: walletId, transaction_type: "withdrawal", order_status: { $in: allowed } }, { $set: { order_status: nextStatus, ...(payoutReference ? { payout_reference: payoutReference } : {}) } }, { new: true });
    if (!result) throw new Error("Withdrawal not found or status transition is not allowed");
    return result;
  } finally { await session.endSession(); }
}

module.exports = { MIN_REMAINING_BALANCE, TRANSITIONS, createWithdrawal, transitionWithdrawal, round2 };
