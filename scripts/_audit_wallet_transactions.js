/**
 * Read-only audit — wallet transactions for dealer 69fd6cf7a88bace872ab1309
 * Run: node scripts/_audit_wallet_transactions.js
 * Does NOT modify any data.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose);

// ── Inline schemas ─────────────────────────────────────────────────────────────

const dealerSchema = new mongoose.Schema({ wallet: { type: Number, default: 0 } }, { strict: false });
const Dealer = mongoose.model("Vendor", dealerSchema);

const walletSchema = new mongoose.Schema({
  orderId:          { type: String },
  dealer_id:        { type: mongoose.Schema.Types.ObjectId },
  Amount:           Number,
  Type:             String,
  Note:             String,
  Total:            Number,
  order_status:     String,
  transaction_type: String,
  pre_balance:      Number,
  booking_id:       mongoose.Schema.Types.ObjectId,
  performed_by:     mongoose.Schema.Types.ObjectId,
}, { timestamps: true, strict: false });

walletSchema.plugin(AutoIncrement, { id: "wallet_seq", inc_field: "id" });
const Wallet = mongoose.model("Wallet", walletSchema);

const DEALER_ID = "69fd6cf7a88bace872ab1309";

async function run() {
  await mongoose.connect(process.env.DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log("Connected to:", mongoose.connection.host, "\n");

  const dealerObjectId = new mongoose.Types.ObjectId(DEALER_ID);

  // ── 1. Vendor.wallet current value ──────────────────────────────────────────
  const dealer = await Dealer.findById(DEALER_ID).select("wallet");
  console.log("══ Vendor.wallet ════════════════════════════════════");
  console.log("  dealer._id :", DEALER_ID);
  console.log("  wallet     : ₹", dealer?.wallet ?? "NOT FOUND");
  console.log("");

  // ── 2. Raw Wallet collection — all docs for this dealer ──────────────────────
  const allTxns = await Wallet.find({ dealer_id: dealerObjectId })
    .sort({ createdAt: -1 })
    .select("_id Amount Type transaction_type order_status Note Total pre_balance orderId createdAt")
    .lean();

  console.log("══ Raw Wallet collection (sorted createdAt DESC) ════");
  console.log("  Total documents found:", allTxns.length);
  console.log("");

  allTxns.forEach((t, i) => {
    console.log(`  [${i + 1}] _id             : ${t._id}`);
    console.log(`       orderId         : ${t.orderId}`);
    console.log(`       Amount          : ₹${t.Amount}`);
    console.log(`       Type            : ${t.Type}`);
    console.log(`       transaction_type: ${t.transaction_type}`);
    console.log(`       order_status    : ${t.order_status}`);
    console.log(`       Note            : ${t.Note}`);
    console.log(`       Total           : ₹${t.Total}`);
    console.log(`       pre_balance     : ₹${t.pre_balance}`);
    console.log(`       createdAt       : ${t.createdAt}`);
    console.log("");
  });

  // ── 3. Look specifically for the ₹2000 dev credit ───────────────────────────
  const devCredit = allTxns.find(
    t => t.Amount === 2000 && t.Type === "Credit" && (t.Note || "").includes("Development testing credit")
  );

  console.log('══ Rs.2000 Credit -- "Development testing credit" ══');
  if (devCredit) {
    console.log("  ✅ EXISTS in Wallet collection");
    console.log("     _id            :", devCredit._id.toString());
    console.log("     order_status   :", devCredit.order_status);
    console.log("     transaction_type:", devCredit.transaction_type);
    console.log("     createdAt      :", devCredit.createdAt);
  } else {
    console.log("  ❌ NOT FOUND in Wallet collection");
    console.log("     The dev_credit_wallet.js script has not been run, or ran against a different DB.");
  }
  console.log("");

  // ── 4. Simulate GetwalletInfo aggregation (exactly as the API does it) ───────
  console.log("══ Simulated GET /dealer/dealerWallet/:id aggregation ════");

  const match = { dealer_id: dealerObjectId };
  // No optional filters (type, status, from, to, search) — same as a bare API call
  const page = 1, limit = 20;
  const skip = (page - 1) * limit;
  const perPage = 20;

  const [agg] = await Wallet.aggregate([
    { $match: match },
    { $sort: { _id: -1 } },
    {
      $facet: {
        transactions: [
          { $skip: skip },
          { $limit: perPage },
          {
            $project: {
              _id: 0,
              id: "$id",
              orderId: 1,
              amount: "$Amount",
              type: "$Type",
              note: "$Note",
              totalAfterTxn: "$Total",
              status: "$order_status",
              createdAt: 1,
            }
          }
        ],
        meta: [{ $count: "total" }],
        // ── summary exactly as it exists TODAY in the controller ──────────────
        // (includes the $match added by Priority 1 fix if already deployed,
        //  or without it if not yet restarted)
        summary_ALL: [
          {
            $group: {
              _id: null,
              credits: { $sum: { $cond: [{ $eq: ["$Type", "Credit"] }, "$Amount", 0] } },
              debits:  { $sum: { $cond: [{ $eq: ["$Type", "Debit"]  }, "$Amount", 0] } },
              count:   { $sum: 1 }
            }
          },
          { $addFields: { currentBalance: { $subtract: ["$credits", "$debits"] } } },
          { $project: { _id: 0 } }
        ],
        summary_FILTERED: [
          { $match: { order_status: { $ne: "REJECTED" }, transaction_type: { $ne: "rollback" } } },
          {
            $group: {
              _id: null,
              credits: { $sum: { $cond: [{ $eq: ["$Type", "Credit"] }, "$Amount", 0] } },
              debits:  { $sum: { $cond: [{ $eq: ["$Type", "Debit"]  }, "$Amount", 0] } },
              count:   { $sum: 1 }
            }
          },
          { $addFields: { currentBalance: { $subtract: ["$credits", "$debits"] } } },
          { $project: { _id: 0 } }
        ]
      }
    }
  ]);

  const transactions = agg?.transactions ?? [];
  const totalDocs    = agg?.meta?.[0]?.total ?? 0;
  const sumAll       = agg?.summary_ALL?.[0]      ?? { credits: 0, debits: 0, currentBalance: 0 };
  const sumFiltered  = agg?.summary_FILTERED?.[0] ?? { credits: 0, debits: 0, currentBalance: 0 };

  console.log(`  data.pagination.total   : ${totalDocs} document(s) in collection`);
  console.log(`  data.transactions.length: ${transactions.length}`);
  console.log("");
  console.log("  data.transactions (as API would return):");
  if (transactions.length === 0) {
    console.log("    [] — empty array");
  } else {
    transactions.forEach((t, i) => {
      console.log(`    [${i + 1}] amount:${t.amount}  type:${t.type}  status:${t.status}  note:${t.note}  createdAt:${t.createdAt}`);
    });
  }

  console.log("");
  console.log("══ Summary comparison ════════════════════════════════");
  console.log("  Without REJECTED/rollback filter (old behaviour):");
  console.log(`    credits        : ₹${sumAll.credits}`);
  console.log(`    debits         : ₹${sumAll.debits}`);
  console.log(`    currentBalance : ₹${sumAll.currentBalance}`);
  console.log("");
  console.log("  With REJECTED/rollback filter (Priority 1 fix):");
  console.log(`    credits        : ₹${sumFiltered.credits}`);
  console.log(`    debits         : ₹${sumFiltered.debits}`);
  console.log(`    currentBalance : ₹${sumFiltered.currentBalance}`);
  console.log("");

  // ── 5. Diagnosis ─────────────────────────────────────────────────────────────
  console.log("══ Diagnosis ═════════════════════════════════════════");

  if (allTxns.length === 0) {
    console.log("  ❌ Wallet collection has ZERO documents for this dealer.");
    console.log("     → dev_credit_wallet.js has not been run against this DB.");
    console.log("     → Run it now: node scripts/dev_credit_wallet.js");
  } else if (transactions.length === 0) {
    console.log("  ❌ Wallet documents exist but aggregation returns empty transactions.");
    console.log("     → Possible cause: dealer_id type mismatch (string vs ObjectId).");
    console.log("     → Check dealer_id values in DB documents below:");
    const raw = await Wallet.collection.find({ dealer_id: DEALER_ID }).toArray();
    console.log(`     String-match count: ${raw.length}`);
  } else if (devCredit && !transactions.find(t => t.note && t.note.includes("Development testing credit"))) {
    console.log("  ⚠️  ₹2000 credit EXISTS in collection but is NOT in API transactions array.");
    console.log("     → Check if it is beyond page 1 (pagination skip).");
    console.log("     → Check order_status — REJECTED entries are filtered from summary but appear in history.");
    console.log("     devCredit.order_status:", devCredit.order_status);
  } else if (devCredit) {
    console.log("  ✅ ₹2000 credit exists AND appears in API data.transactions.");
  } else {
    console.log("  ❌ ₹2000 credit does not exist in the Wallet collection.");
  }

  console.log("\n══ Done (no data was modified) ══════════════════════\n");
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
