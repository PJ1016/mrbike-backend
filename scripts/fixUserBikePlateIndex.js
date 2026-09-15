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

const LEGACY_INDEX_NAME = "plate_number_1";
const NEW_INDEX_NAME = "user_id_1_plate_number_1";

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
    const indexes = await collection.indexes();
    const legacy = indexes.find((i) => i.name === LEGACY_INDEX_NAME);
    const compound = indexes.find((i) => i.name === NEW_INDEX_NAME);

    if (!legacy && compound) {
      console.log("✓ Nothing to do — the per-user index is already in place.");
      return;
    }

    if (!compound) {
      // The old global index guarantees no two bikes share a plate at all, so
      // this can only fail on a database where it was already dropped by hand.
      const duplicates = await collection
        .aggregate([
          { $group: { _id: { user_id: "$user_id", plate_number: "$plate_number" }, count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } },
        ])
        .toArray();

      if (duplicates.length) {
        console.error(
          `✗ ${duplicates.length} rider(s) have the same plate twice in their own garage — ` +
            "resolve these before the unique index can be built:"
        );
        duplicates.forEach((d) =>
          console.error(`   user ${d._id.user_id} / ${d._id.plate_number} ×${d.count}`)
        );
        process.exitCode = 1;
        return;
      }

      await collection.createIndex(
        { user_id: 1, plate_number: 1 },
        { unique: true, name: NEW_INDEX_NAME }
      );
      console.log(`✓ Created the unique compound index ${NEW_INDEX_NAME}`);
    }

    if (legacy) {
      await collection.dropIndex(LEGACY_INDEX_NAME);
      console.log(`✓ Dropped the old global index ${LEGACY_INDEX_NAME}`);
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
