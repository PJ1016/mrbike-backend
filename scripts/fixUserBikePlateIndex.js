/**
 * One-off index repair for user bikes.
 *
 * `userbikes` carried `{ plate_number: 1 }` as a GLOBAL UNIQUE index, and
 * addUserBike checked `UserBike.findOne({ plate_number })` across every
 * customer. A rider whose plate happened to be registered on another account
 * was told "A bike with this plate number already exists!" while My Bikes —
 * which only ever lists `{ user_id }` — sat empty, so there was nothing on
 * screen to explain the rejection.
 *
 * The schema now declares `{ user_id: 1, plate_number: 1 }` unique instead.
 * Mongoose's autoIndex builds the new compound index on boot but never drops
 * the old one, and while `plate_number_1` survives it keeps rejecting exactly
 * the inserts this change is meant to allow. Run once against each environment
 * before (or right after) deploying the model change:
 *
 *   node scripts/fixUserBikePlateIndex.js
 *
 * Safe to re-run: it does nothing once the compound index is in place and the
 * old one is gone.
 */

const mongoose = require("mongoose");
require("dotenv").config();
const { ensureUserBikePlateIndexes } = require("../utils/userBikeIndexes");

async function fixUserBikePlateIndex() {
  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!uri) {
    console.error("✗ No DATABASE_URL / MONGODB_URI in the environment.");
    process.exitCode = 1;
    return;
  }

  try {
    await mongoose.connect(uri);
    const collection = mongoose.connection.db.collection("userbikes");
    const result = await ensureUserBikePlateIndexes(mongoose.connection.db);

    if (result.createdPerUserIndex) {
      console.log("✓ Created the unique per-user bike registration index");
    }
    result.droppedGlobalIndexes.forEach((name) =>
      console.log(`✓ Dropped the old global index ${name}`),
    );
    if (!result.createdPerUserIndex && result.droppedGlobalIndexes.length === 0) {
      console.log("✓ Nothing to do — the per-user index is already in place.");
    }

    const plates = await collection.distinct("plate_number");
    const bikes = await collection.countDocuments();
    console.log(`  ${bikes} bike(s) across ${plates.length} distinct plate(s); a plate may now be`);
    console.log("  registered once per rider instead of once across the whole platform.");
  } catch (error) {
    console.error("Error repairing the UserBike plate_number index:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

if (require.main === module) {
  fixUserBikePlateIndex();
}

module.exports = fixUserBikePlateIndex;
