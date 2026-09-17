/**
 * Controlled repair for legacy Vendor documents whose wallet is null/missing.
 *
 * Dry-run is the default and performs no writes:
 *   node scripts/normalizeNullDealerWallets.js
 *
 * Apply only after reviewing the count/sample:
 *   node scripts/normalizeNullDealerWallets.js --apply
 *
 * The update filter can only match null/missing wallets. Positive, zero and
 * negative numeric balances are never selected or overwritten.
 */
const mongoose = require("mongoose");
require("dotenv").config();
const Vendor = require("../models/dealerModel");
const { NULLISH_WALLET_FILTER } = require("../helper/dealerWalletNormalization");

async function normalizeNullDealerWallets({ apply = false } = {}) {
  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!uri) throw new Error("DATABASE_URL / MONGODB_URI is required");

  await mongoose.connect(uri);
  try {
    const [count, sample] = await Promise.all([
      Vendor.countDocuments(NULLISH_WALLET_FILTER),
      Vendor.find(NULLISH_WALLET_FILTER).select("_id shopName wallet").limit(20).lean(),
    ]);

    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", count, sample }, null, 2));
    if (!apply || count === 0) return { matchedCount: count, modifiedCount: 0 };

    const result = await Vendor.updateMany(NULLISH_WALLET_FILTER, { $set: { wallet: 0 } });
    console.log(JSON.stringify({ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }, null, 2));
    return result;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  normalizeNullDealerWallets({ apply: process.argv.includes("--apply") }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { normalizeNullDealerWallets };
