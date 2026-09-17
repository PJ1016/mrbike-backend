const mongoose = require("mongoose");
const Vendor = require("../models/dealerModel");
const Wallet = require("../models/Wallet_modal");
const CREDIT_LIMIT = -500;
const round2 = (value) => Number(Number(value).toFixed(2));
const unsupported = (error) => /Transaction numbers are only allowed|replica set|mongos/i.test(error?.message || "");

async function applyInternal({ dealerId, amount, direction, reason, reference, adminId, idempotencyKey }, session) {
  const existing = await Wallet.findOne({ dealer_id: dealerId, idempotency_key: idempotencyKey }).session(session);
  if (existing) return { existing: true, wallet: existing };
  const signed = direction === "Credit" ? amount : -amount;
  const dealer = await Vendor.findOneAndUpdate(
    direction === "Debit" ? { _id: dealerId, wallet: { $gte: round2(amount + CREDIT_LIMIT) } } : { _id: dealerId },
    { $inc: { wallet: signed } }, { new: true, session },
  );
  if (!dealer) throw new Error(direction === "Debit" ? "Adjustment would exceed the ₹500 credit limit" : "Dealer not found");
  const [wallet] = await Wallet.create([{
    orderId: reference, dealer_id: dealer._id, Amount: amount, Type: direction, Note: reason,
    Total: round2(dealer.wallet), pre_balance: round2(dealer.wallet - signed), order_status: "APPROVED",
    transaction_type: "manual", performed_by: adminId, idempotency_key: idempotencyKey,
  }], { session });
  return { existing: false, wallet };
}

async function applyAdminWalletAdjustment(args) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await applyInternal(args, session); });
    return result;
  } catch (error) {
    if (!unsupported(error)) throw error;
    const prior = await Wallet.findOne({ dealer_id: args.dealerId, idempotency_key: args.idempotencyKey });
    if (prior) return { existing: true, wallet: prior };
    return applyInternal(args, null);
  } finally { await session.endSession(); }
}
module.exports = { applyAdminWalletAdjustment, CREDIT_LIMIT };
