const assert = require("assert");
const mongoose = require("mongoose");
const Vendor = require("../models/dealerModel");
const Wallet = require("../models/Wallet_modal");
const { applyAdminWalletAdjustment } = require("../services/adminWalletAdjustmentService");

const originalSession = mongoose.startSession;
const originalVendorFindOneAndUpdate = Vendor.findOneAndUpdate;
const originalWalletFindOne = Wallet.findOne;
const originalWalletCreate = Wallet.create;

async function run() {
  mongoose.startSession = async () => ({
    withTransaction: async (work) => work(),
    endSession: async () => {},
  });

  let balance = 1000;
  let ledger = null;
  let credits = 0;
  Wallet.findOne = () => ({ session: async () => ledger });
  Vendor.findOneAndUpdate = async (_query, update) => {
    balance += update.$inc.wallet;
    credits += 1;
    return { _id: "dealer-1", wallet: balance };
  };
  Wallet.create = async (rows) => {
    ledger = { _id: "deposit-1", ...rows[0] };
    return [ledger];
  };

  const request = {
    dealerId: "dealer-1",
    amount: 250,
    direction: "Credit",
    reason: "Opening float",
    reference: "BANK-123",
    adminId: "admin-1",
    idempotencyKey: "admin-deposit-1",
    transactionType: "deposit",
  };
  const first = await applyAdminWalletAdjustment(request);
  const retry = await applyAdminWalletAdjustment(request);

  assert.strictEqual(first.wallet.transaction_type, "deposit");
  assert.strictEqual(first.wallet.pre_balance, 1000);
  assert.strictEqual(first.wallet.Total, 1250);
  assert.strictEqual(retry.existing, true);
  assert.strictEqual(balance, 1250);
  assert.strictEqual(credits, 1);
  console.log("adminWalletDeposit.test.js: all tests passed");
}

run().finally(() => {
  mongoose.startSession = originalSession;
  Vendor.findOneAndUpdate = originalVendorFindOneAndUpdate;
  Wallet.findOne = originalWalletFindOne;
  Wallet.create = originalWalletCreate;
});
