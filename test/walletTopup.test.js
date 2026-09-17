const assert = require("assert");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Vendor = require("../models/dealerModel");
const Wallet = require("../models/Wallet_modal");
const { finalizeWalletTopup } = require("../services/walletTopupService");

const originals = {
  startSession: mongoose.startSession,
  paymentFindOneAndUpdate: Payment.findOneAndUpdate,
  paymentFindById: Payment.findById,
  paymentUpdateOne: Payment.updateOne,
  vendorFindOneAndUpdate: Vendor.findOneAndUpdate,
  vendorUpdateOne: Vendor.updateOne,
  walletFindOne: Wallet.findOne,
  walletCreate: Wallet.create,
};

function unsupportedSessions() {
  mongoose.startSession = async () => ({
    withTransaction: async () => { throw new Error("Transaction numbers are only allowed on a replica set member"); },
    endSession: async () => {},
  });
}

function install({ payment, dealer = { _id: "dealer-1", wallet: 110 }, existingWallet = null, createError = null }) {
  let claimed = false;
  let ledger = existingWallet;
  let balance = dealer?.wallet;
  let updateCalls = [];
  Payment.findOneAndUpdate = async () => {
    if (!payment || claimed || payment.order_status !== "SUCCESS" || payment.payment_type !== "WALLET_TOPUP") return null;
    claimed = true;
    return payment;
  };
  Payment.findById = async () => null;
  Payment.updateOne = async (...args) => { updateCalls.push(args); return { modifiedCount: 1 }; };
  Wallet.findOne = async () => ledger;
  Wallet.create = async (row) => {
    if (createError) throw createError;
    ledger = { _id: "ledger-1", ...row, createdAt: new Date() };
    return ledger;
  };
  Vendor.findOneAndUpdate = async (_query, update) => {
    if (!dealer) return null;
    balance = Number((balance + update.$inc.wallet).toFixed(2));
    return { ...dealer, wallet: balance };
  };
  Vendor.updateOne = async (_query, update) => {
    if (update.$inc?.wallet) balance += update.$inc.wallet;
    return { modifiedCount: 1 };
  };
  return { get ledger() { return ledger; }, get balance() { return balance; }, updateCalls };
}

async function run() {
  unsupportedSessions();

  // Successful ₹10 top-up: exactly one balance increment and approved ledger.
  let state = install({ payment: { _id: "pay-1", orderId: "WTOP-1", dealer_id: "dealer-1", orderAmount: 10, order_status: "SUCCESS", payment_type: "WALLET_TOPUP" } });
  let result = await finalizeWalletTopup("pay-1");
  assert.strictEqual(result.credited, true);
  assert.strictEqual(state.balance, 120);
  assert.strictEqual(state.ledger.Amount, 10);
  assert.strictEqual(state.ledger.Total, 120);
  assert.strictEqual(state.ledger.pre_balance, 110);
  assert.strictEqual(state.ledger.order_status, "APPROVED");
  assert.strictEqual(state.ledger.transaction_type, "deposit");
  assert.strictEqual(state.ledger.dealer_id, "dealer-1");

  // Webhook duplicate/retry: claimed order is a no-op; no second credit/ledger.
  result = await finalizeWalletTopup("pay-1");
  assert.strictEqual(result.credited, false);
  assert.strictEqual(state.balance, 120);

  // Failed/pending payments cannot be claimed or credited.
  state = install({ payment: { _id: "pay-2", orderId: "WTOP-2", dealer_id: "dealer-1", orderAmount: 10, order_status: "FAILED", payment_type: "WALLET_TOPUP" } });
  result = await finalizeWalletTopup("pay-2");
  assert.strictEqual(result.credited, false);
  assert.strictEqual(state.balance, 110);
  assert.strictEqual(state.ledger, null);

  // Missing dealer fails before a ledger is created.
  state = install({ payment: { _id: "pay-3", orderId: "WTOP-3", dealer_id: "missing", orderAmount: 10, order_status: "SUCCESS", payment_type: "WALLET_TOPUP" }, dealer: null });
  await assert.rejects(() => finalizeWalletTopup("pay-3"), /dealer not found/);
  assert.strictEqual(state.ledger, null);

  // If fallback ledger insertion fails, its conditional balance increment is compensated.
  state = install({ payment: { _id: "pay-4", orderId: "WTOP-4", dealer_id: "dealer-1", orderAmount: 10, order_status: "SUCCESS", payment_type: "WALLET_TOPUP" }, createError: new Error("ledger unavailable") });
  await assert.rejects(() => finalizeWalletTopup("pay-4"), /ledger unavailable/);
  assert.strictEqual(state.balance, 110);

  console.log("walletTopup.test.js: all tests passed");
}

run().finally(() => {
  mongoose.startSession = originals.startSession;
  Payment.findOneAndUpdate = originals.paymentFindOneAndUpdate;
  Payment.findById = originals.paymentFindById;
  Payment.updateOne = originals.paymentUpdateOne;
  Vendor.findOneAndUpdate = originals.vendorFindOneAndUpdate;
  Vendor.updateOne = originals.vendorUpdateOne;
  Wallet.findOne = originals.walletFindOne;
  Wallet.create = originals.walletCreate;
});
