/**
 * One-time wallet reconciliation — 2026-06-08
 * Dealer: 69fd6cf7a88bace872ab1309
 *
 * Verified state:
 *   Vendor.wallet              = 1850.1
 *   Existing ledger (Debit)    = 149.9  (settlement_cash)
 *   Missing historical credit  = 2000   (opening balance never recorded)
 *
 * This script inserts ONE Credit ledger entry so the aggregate becomes:
 *   credits (2000) − debits (149.9) = currentBalance 1850.1 ✓
 *
 * Vendor.wallet is NEVER modified.
 * Run ONCE: node scripts/reconcile_wallet_20260608.js
 * Idempotent — aborts if orderId RECONCILIATION-20260608 already exists.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose);

// ── Inline schemas ─────────────────────────────────────────────────────────────

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
    enum: ["ACTIVE","PAID","PENDING","IN_PROGRESS","COMPLETED","FAILED","EXPIRED","APPROVED","REJECTED"],
    default: "PENDING",
  },
  transaction_type: {
    type: String,
    enum: ["settlement_online","settlement_cash","withdrawal","deposit","manual","reconciliation","rollback"],
    default: "manual",
  },
  pre_balance:      Number,
  booking_id:       mongoose.Schema.Types.ObjectId,
  performed_by:     mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

walletSchema.plugin(AutoIncrement, { id: "wallet_seq", inc_field: "id" });
const Wallet = mongoose.model("Wallet", walletSchema);

// ── Config ─────────────────────────────────────────────────────────────────────

const DEALER_ID      = "69fd6cf7a88bace872ab1309";
const RECON_ORDER_ID = "RECONCILIATION-20260608";
const CREDIT_AMOUNT  = 2000;
const EXPECTED_WALLET = 1850.1;

// ── Helpers ────────────────────────────────────────────────────────────────────

function round2(n) { return Math.round(n * 100) / 100; }

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  await mongoose.connect(process.env.DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log("Connected to:", mongoose.connection.host);

  const dealerOid = new mongoose.Types.ObjectId(DEALER_ID);

  // ── 1. Idempotency guard ──────────────────────────────────────────────────────
  const existing = await Wallet.findOne({ orderId: RECON_ORDER_ID, dealer_id: dealerOid });
  if (existing) {
    console.log("\n⚠️  Entry RECONCILIATION-20260608 already exists — aborting to prevent duplicate.");
    console.log("   Existing _id:", existing._id.toString());
    await mongoose.disconnect();
    return;
  }

  // ── 2. Verify Vendor.wallet has not changed ───────────────────────────────────
  const dealer = await Dealer.findById(DEALER_ID);
  if (!dealer) throw new Error(`Dealer not found: ${DEALER_ID}`);

  console.log("\n── Pre-insert state ─────────────────────────────────────────────────");
  console.log("  Vendor.wallet  :", dealer.wallet);
  console.log("  Expected       : ₹", EXPECTED_WALLET);

  if (Math.abs(round2(parseFloat(dealer.wallet)) - EXPECTED_WALLET) > 0.01) {
    console.error(`\n❌  Vendor.wallet (${dealer.wallet}) does not match expected ₹${EXPECTED_WALLET}.`);
    console.error("    Update EXPECTED_WALLET in this script before running.");
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log("  ✅ Vendor.wallet matches expected value — proceeding.");

  // ── 3. Insert reconciliation credit ──────────────────────────────────────────
  const entry = await Wallet.create({
    dealer_id:        dealerOid,
    orderId:          RECON_ORDER_ID,
    Amount:           CREDIT_AMOUNT,
    Type:             "Credit",
    transaction_type: "reconciliation",
    order_status:     "APPROVED",
    Note:             "Historical balance reconciliation",
    pre_balance:      0,
    Total:            CREDIT_AMOUNT,   // 2000 — ledger snapshot at time of this opening entry
  });

  console.log("\n── 1. Inserted Wallet document ──────────────────────────────────────");
  console.log("  _id             :", entry._id.toString());
  console.log("  dealer_id       :", entry.dealer_id.toString());
  console.log("  orderId         :", entry.orderId);
  console.log("  Amount          : ₹", entry.Amount);
  console.log("  Type            :", entry.Type);
  console.log("  transaction_type:", entry.transaction_type);
  console.log("  order_status    :", entry.order_status);
  console.log("  Note            :", entry.Note);
  console.log("  pre_balance     : ₹", entry.pre_balance);
  console.log("  Total           : ₹", entry.Total);
  console.log("  createdAt       :", entry.createdAt);

  // ── 4. Aggregate summary (mirrors GET /bikedoctor/dealer/dealerWallet/:id) ────
  const [agg] = await Wallet.aggregate([
    { $match: { dealer_id: dealerOid } },
    { $sort: { _id: -1 } },
    {
      $facet: {
        transactions: [
          { $limit: 50 },
          {
            $project: {
              _id: 0,
              id: "$id",
              orderId: 1,
              amount:       "$Amount",
              type:         "$Type",
              note:         "$Note",
              totalAfterTxn:"$Total",
              status:       "$order_status",
              transactionType: "$transaction_type",
              createdAt: 1,
            }
          }
        ],
        meta: [{ $count: "total" }],
        summary: [
          {
            $match: {
              order_status:     { $ne: "REJECTED" },
              transaction_type: { $ne: "rollback" },
            }
          },
          {
            $group: {
              _id:     null,
              credits: { $sum: { $cond: [{ $eq: ["$Type", "Credit"] }, "$Amount", 0] } },
              debits:  { $sum: { $cond: [{ $eq: ["$Type", "Debit"]  }, "$Amount", 0] } },
              count:   { $sum: 1 },
            }
          },
          { $addFields: { currentBalance: { $subtract: ["$credits", "$debits"] } } },
          { $project: { _id: 0 } },
        ],
      }
    }
  ]);

  const transactions   = agg?.transactions ?? [];
  const totalDocs      = agg?.meta?.[0]?.total ?? 0;
  const summary        = agg?.summary?.[0] ?? { credits: 0, debits: 0, currentBalance: 0 };

  console.log("\n── 2. Aggregate summary after insert ────────────────────────────────");
  console.log("  Total ledger documents  :", totalDocs);
  console.log("  credits                 : ₹", summary.credits);
  console.log("  debits                  : ₹", summary.debits);
  console.log("  currentBalance          : ₹", summary.currentBalance);

  // ── 5. Transaction history ────────────────────────────────────────────────────
  console.log("\n── 3. Transaction history (GET /bikedoctor/dealer/dealerWallet/:id) ─");
  if (transactions.length === 0) {
    console.log("  [] — no transactions returned");
  } else {
    transactions.forEach((t, i) => {
      console.log(
        `  [${i + 1}]  orderId:${t.orderId}  amount:₹${t.amount}  type:${t.type}` +
        `  txnType:${t.transactionType}  status:${t.status}  balance:₹${t.totalAfterTxn}  note:${t.note || "—"}`
      );
    });
  }

  // ── 6. Final confirmation ─────────────────────────────────────────────────────
  console.log("\n── 4. Confirmation ──────────────────────────────────────────────────");
  const creditsOk       = Math.abs(round2(summary.credits)        - 2000)   < 0.01;
  const debitsOk        = Math.abs(round2(summary.debits)         - 149.9)  < 0.01;
  const balanceOk       = Math.abs(round2(summary.currentBalance) - EXPECTED_WALLET) < 0.01;
  const matchesVendor   = balanceOk;

  console.log(`  credits  = ₹${summary.credits}  ${creditsOk  ? "✅ (expected 2000)"  : "❌"}`);
  console.log(`  debits   = ₹${summary.debits}   ${debitsOk   ? "✅ (expected 149.9)" : "❌"}`);
  console.log(`  currentBalance = ₹${summary.currentBalance}  vs  Vendor.wallet = ₹${dealer.wallet}  ${matchesVendor ? "✅ MATCH" : "❌ MISMATCH"}`);

  if (creditsOk && debitsOk && matchesVendor) {
    console.log("\n✅ Reconciliation complete. Ledger is consistent with Vendor.wallet.");
    console.log("   Vendor.wallet was NOT modified.");
  } else {
    console.log("\n⚠️  One or more checks failed — review the aggregate output above.");
  }

  console.log("─────────────────────────────────────────────────────────────────────\n");
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
