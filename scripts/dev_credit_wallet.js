/**
 * Dev-only: manually credit dealer wallet.
 * No booking, no payment, no settlement logic.
 * Run: node scripts/dev_credit_wallet.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose);

// ── Inline schemas (avoid loading full app) ──────────────────────────────────

const dealerSchema = new mongoose.Schema({ wallet: { type: Number, default: 0 } }, { strict: false });
// Actual collection is "vendors" (model registered as "Vendor" in dealerModel.js)
const Dealer = mongoose.model("Vendor", dealerSchema);

const walletSchema = new mongoose.Schema({
  orderId:          { type: String, required: true },
  dealer_id:        { type: mongoose.Schema.Types.ObjectId, ref: "dealer" },
  Amount:           Number,
  Type:             { type: String, enum: ["Credit", "Debit", "Pending"] },
  Note:             String,
  Total:            Number,
  order_status:     { type: String, enum: ["ACTIVE","PAID","PENDING","IN_PROGRESS","COMPLETED","FAILED","EXPIRED","APPROVED","REJECTED"], default: "PENDING" },
  transaction_type: { type: String, enum: ["settlement_online","settlement_cash","withdrawal","deposit","manual"], default: "manual" },
  pre_balance:      Number,
  booking_id:       mongoose.Schema.Types.ObjectId,
  performed_by:     mongoose.Schema.Types.ObjectId,
}, { timestamps: true });
walletSchema.plugin(AutoIncrement, { id: "wallet_seq", inc_field: "id" });
const Wallet = mongoose.model("Wallet", walletSchema);

// ── Config ────────────────────────────────────────────────────────────────────

const DEALER_ID   = "69fd6cf7a88bace872ab1309";
const CREDIT      = 2000;

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  await mongoose.connect(process.env.DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log("Connected to:", mongoose.connection.host);

  const dealer = await Dealer.findById(DEALER_ID);
  if (!dealer) throw new Error(`Dealer not found: ${DEALER_ID}`);

  const prevBalance = dealer.wallet ?? 0;
  const newBalance  = prevBalance + CREDIT;

  // 1. Update wallet balance
  await Dealer.findByIdAndUpdate(DEALER_ID, { wallet: newBalance });

  // 2. Create ledger entry
  const entry = await Wallet.create({
    orderId:          `MANUAL-${Date.now()}`,
    dealer_id:        dealer._id,
    Amount:           CREDIT,
    Type:             "Credit",
    transaction_type: "manual",
    order_status:     "APPROVED",
    Note:             "Development testing credit",
    Total:            newBalance,
    pre_balance:      prevBalance,
  });

  console.log("\n── Result ───────────────────────────────────");
  console.log("Previous wallet balance : ₹", prevBalance);
  console.log("New wallet balance      : ₹", newBalance);
  console.log("Wallet transaction _id  :", entry._id.toString());
  console.log("─────────────────────────────────────────────\n");

  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
