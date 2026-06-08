/**
 * One-time reconciliation for dealer 69fd6cf7a88bace872ab1309.
 *
 * Problem: Vendor.wallet = 1850.1, but Wallet ledger has no entries for this
 * amount because historical booking payouts wrote directly to Vendor.wallet
 * without creating ledger records (via the now-dead addAmount / calculateDealerAmount
 * code paths).
 *
 * Fix: Insert a single reconciliation ledger entry so that the ledger balance
 * reflects the real wallet balance. Vendor.wallet is NOT modified.
 *
 * Run ONCE: node scripts/reconcile_wallet.js
 * Safe to re-run — the idempotency check at the top prevents duplicate entries.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose);

// ── Inline schemas (avoid loading full app) ───────────────────────────────────

const dealerSchema = new mongoose.Schema({ wallet: { type: Number, default: 0 } }, { strict: false });
const Dealer = mongoose.model("Vendor", dealerSchema);

const walletSchema = new mongoose.Schema({
  orderId:          { type: String, required: true },
  dealer_id:        { type: mongoose.Schema.Types.ObjectId, ref: "dealer" },
  Amount:           Number,
  Type:             { type: String, enum: ["Credit", "Debit", "Pending"] },
  Note:             String,
  Total:            Number,
  order_status:     {
    type: String,
    enum: ["ACTIVE", "PAID", "PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "EXPIRED", "APPROVED", "REJECTED"],
    default: "PENDING",
  },
  transaction_type: {
    type: String,
    enum: ["settlement_online", "settlement_cash", "withdrawal", "deposit", "manual", "reconciliation", "rollback"],
    default: "manual",
  },
  pre_balance:      Number,
  booking_id:       mongoose.Schema.Types.ObjectId,
  performed_by:     mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

walletSchema.plugin(AutoIncrement, { id: "wallet_seq", inc_field: "id" });
const Wallet = mongoose.model("Wallet", walletSchema);

// ── Config ────────────────────────────────────────────────────────────────────

const DEALER_ID        = "69fd6cf7a88bace872ab1309";
const RECONCILE_AMOUNT = 1850.1;
const RECON_ORDER_ID   = `RECON-${DEALER_ID}`;

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  await mongoose.connect(process.env.DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log("Connected to:", mongoose.connection.host);

  // Idempotency — abort if a reconciliation entry already exists for this dealer
  const existing = await Wallet.findOne({ orderId: RECON_ORDER_ID, dealer_id: new mongoose.Types.ObjectId(DEALER_ID) });
  if (existing) {
    console.log("⚠️  Reconciliation entry already exists. Aborting to prevent duplicate.");
    console.log("   Existing entry _id:", existing._id.toString());
    await mongoose.disconnect();
    return;
  }

  // Safety check — verify current Vendor.wallet matches expected value
  const dealer = await Dealer.findById(DEALER_ID);
  if (!dealer) throw new Error(`Dealer not found: ${DEALER_ID}`);

  console.log("\n── Pre-reconciliation state ─────────────────");
  console.log("Vendor.wallet        :", dealer.wallet);
  console.log("Expected to reconcile: ₹", RECONCILE_AMOUNT);

  if (Math.abs(parseFloat(dealer.wallet) - RECONCILE_AMOUNT) > 0.01) {
    console.warn(`\n⚠️  Vendor.wallet (${dealer.wallet}) does not match expected ₹${RECONCILE_AMOUNT}.`);
    console.warn("   Update RECONCILE_AMOUNT in this script to match the actual wallet value before running.");
    await mongoose.disconnect();
    process.exit(1);
  }

  // Create reconciliation ledger entry — Vendor.wallet is NOT modified
  const entry = await Wallet.create({
    orderId:          RECON_ORDER_ID,
    dealer_id:        new mongoose.Types.ObjectId(DEALER_ID),
    Amount:           RECONCILE_AMOUNT,
    Type:             "Credit",
    transaction_type: "reconciliation",
    order_status:     "APPROVED",
    Note:             "Historical balance reconciliation",
    Total:            RECONCILE_AMOUNT,
    pre_balance:      0,
  });

  console.log("\n── Reconciliation result ────────────────────");
  console.log("Ledger entry _id     :", entry._id.toString());
  console.log("Amount               : ₹", entry.Amount);
  console.log("Type                 :", entry.Type);
  console.log("transaction_type     :", entry.transaction_type);
  console.log("order_status         :", entry.order_status);
  console.log("Note                 :", entry.Note);
  console.log("Total (after txn)    : ₹", entry.Total);
  console.log("\n✅ Vendor.wallet unchanged. Ledger now matches wallet balance.");
  console.log("─────────────────────────────────────────────\n");

  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
