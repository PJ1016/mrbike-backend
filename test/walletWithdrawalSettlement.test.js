const assert = require("assert");
const mongoose = require("mongoose");
const Vendor = require("../models/dealerModel");
const Wallet = require("../models/Wallet_modal");
const { createWithdrawal, TRANSITIONS } = require("../services/withdrawalService");
const Booking = require("../models/Booking");
const { settleBookingWallet } = require("../helper/walletSettlement");

const originalSession = mongoose.startSession;
const originalVendorFindOneAndUpdate = Vendor.findOneAndUpdate;
const originalVendorUpdateOne = Vendor.updateOne;
const originalWalletFindOne = Wallet.findOne;
const originalWalletCreate = Wallet.create;
const originalBookingFindOneAndUpdate = Booking.findOneAndUpdate;
const originalBookingExists = Booking.exists;
const originalVendorFindById = Vendor.findById;

async function run() {
  // Exercise the standalone safe path. Its conditional $gte update is the
  // concurrency guard used when a Mongo transaction is unavailable.
  mongoose.startSession = async () => ({
    withTransaction: async () => { throw new Error("Transaction numbers are only allowed on a replica set member"); },
    endSession: async () => {},
  });
  let balance = 500;
  let ledger = null;
  Vendor.findOneAndUpdate = async (query, update) => {
    const minimum = query.wallet.$gte;
    if (balance < minimum) return null;
    balance += update.$inc.wallet;
    return { _id: "dealer-1", wallet: balance };
  };
  Vendor.updateOne = async (_query, update) => { balance += update.$inc.wallet; return { modifiedCount: 1 }; };
  Wallet.findOne = async () => ledger;
  Wallet.create = async (row) => { ledger = { _id: "wd-1", ...row }; return ledger; };

  const result = await createWithdrawal({ dealerId: "dealer-1", amount: 300, performedBy: "dealer-1", idempotencyKey: "withdraw-1" });
  assert.strictEqual(result.wallet.transaction_type, "withdrawal");
  assert.strictEqual(result.wallet.order_status, "PENDING");
  assert.strictEqual(result.wallet.pre_balance, 500);
  assert.strictEqual(result.wallet.Total, 200);
  assert.strictEqual(balance, 200);

  // A competing request cannot take balance below the mandatory ₹200 reserve.
  await assert.rejects(() => createWithdrawal({ dealerId: "dealer-1", amount: 1, performedBy: "dealer-1" }));
  assert.strictEqual(balance, 200);

  // A retry with the same key returns the existing reservation, not a debit.
  const retry = await createWithdrawal({ dealerId: "dealer-1", amount: 300, performedBy: "dealer-1", idempotencyKey: "withdraw-1" });
  assert.strictEqual(retry.existing, true);
  assert.strictEqual(balance, 200);

  assert.deepStrictEqual(TRANSITIONS.PENDING, ["IN_PROGRESS", "REJECTED"]);
  assert.deepStrictEqual(TRANSITIONS.IN_PROGRESS, ["APPROVED", "REJECTED"]);

  // Online and cash settlement use frozen booking values, produce one matching
  // ledger row, and a repeat claim is a no-op.
  async function exerciseSettlement(method) {
    const entries = [];
    let claimed = false;
    const dealer = { _id: "dealer-1", wallet: 100, save: async () => {} };
    const booking = {
      _id: `booking-${method}`, bookingId: `MRB-${method}`, dealer_id: "dealer-1", walletSettled: false,
      pricingVersion: 1, totalBill: 1000, tax: 180, customerTotal: 1180,
      commissionRate: 10, commissionAmount: 100, commissionTaxRate: 18,
      commissionTaxAmount: 18, platformFee: 20, dealerEarnings: 882,
    };
    Booking.findOneAndUpdate = async () => {
      if (claimed) return null;
      claimed = true;
      booking.walletSettled = true;
      return booking;
    };
    Booking.exists = () => ({ session: async () => true });
    Vendor.findById = () => ({ session: async () => dealer });
    Wallet.findOne = () => ({ session: async () => null });
    Wallet.create = async (rows) => { entries.push(rows[0]); return rows; };
    const first = await settleBookingWallet(booking._id, method);
    const second = await settleBookingWallet(booking._id, method);
    assert.ok(first);
    assert.strictEqual(second, null);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].Total, dealer.wallet);
    assert.strictEqual(entries[0].pre_balance, 100);
    return { dealer, entry: entries[0] };
  }
  let settled = await exerciseSettlement("ONLINE");
  assert.strictEqual(settled.entry.Type, "Credit");
  assert.strictEqual(settled.entry.Amount, 882);
  assert.strictEqual(settled.dealer.wallet, 982);
  settled = await exerciseSettlement("CASH");
  assert.strictEqual(settled.entry.Type, "Debit");
  assert.strictEqual(settled.entry.Amount, 138);
  assert.strictEqual(settled.dealer.wallet, -38);
  console.log("walletWithdrawalSettlement.test.js: all tests passed");
}

run().finally(() => {
  mongoose.startSession = originalSession;
  Vendor.findOneAndUpdate = originalVendorFindOneAndUpdate;
  Vendor.updateOne = originalVendorUpdateOne;
  Wallet.findOne = originalWalletFindOne;
  Wallet.create = originalWalletCreate;
  Booking.findOneAndUpdate = originalBookingFindOneAndUpdate;
  Booking.exists = originalBookingExists;
  Vendor.findById = originalVendorFindById;
});
