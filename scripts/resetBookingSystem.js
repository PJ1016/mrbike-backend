/**
 * ⚠️  DEVELOPMENT / TEST ENVIRONMENT ONLY ⚠️
 *
 * Permanently deletes ALL records from every booking-related collection.
 * Run manually:  node scripts/resetBookingSystem.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

// ── Models ────────────────────────────────────────────────────────────────────
const Booking      = require("../models/Booking");
const Payment      = require("../models/Payment");
const Bill         = require("../models/billSchema");
const Wallet       = require("../models/Wallet_modal");
const Reward       = require("../models/reward");
const Tracking     = require("../models/Tracking");
const Notification = require("../models/Notification");
const Report       = require("../models/report_Model");

// ── Connection ────────────────────────────────────────────────────────────────
const MONGO_URI =
  process.env.DATABASE_URL ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/BikeDoctor";

// ── Collections to reset (order matters: children before parent) ──────────────
const COLLECTIONS = [
  { name: "Payment",      model: Payment      },
  { name: "Bill",         model: Bill         },
  { name: "Wallet",       model: Wallet       },
  { name: "Reward",       model: Reward       },
  { name: "Tracking",     model: Tracking     },
  { name: "Notification", model: Notification },
  { name: "Report",       model: Report       },
  { name: "Booking",      model: Booking      },
];

async function deleteAll(name, model) {
  try {
    const before = await model.countDocuments();
    const result = await model.deleteMany({});
    const after  = await model.countDocuments();
    const status = after === 0 ? "✓" : "✗";
    console.log(`${status}  ${name.padEnd(14)} ${before} → ${after}  (deleted: ${result.deletedCount})`);
    return after === 0;
  } catch (err) {
    console.error(`✗  ${name}: ERROR — ${err.message}`);
    return false;
  }
}

async function run() {
  console.log("\n⚠️  BOOKING SYSTEM RESET — DEVELOPMENT/TEST ONLY ⚠️\n");

  await mongoose.connect(MONGO_URI, {
    useNewUrlParser:    true,
    useUnifiedTopology: true,
  });
  console.log(`Connected: ${mongoose.connection.host}\n`);

  console.log("Collection       Before → After");
  console.log("─".repeat(40));

  let allClean = true;
  for (const { name, model } of COLLECTIONS) {
    const ok = await deleteAll(name, model);
    if (!ok) allClean = false;
  }

  console.log("─".repeat(40));

  if (allClean) {
    console.log("\nReset completed successfully.\n");
  } else {
    console.error("\nReset completed with errors — some collections may not be empty.\n");
    process.exitCode = 1;
  }

  await mongoose.connection.close();
  process.exit(process.exitCode || 0);
}

run().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
