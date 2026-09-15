/**
 * One-off index repair for App Content banners.
 *
 * `appbanners` carried `{ legacyBannerId: 1 }` as a UNIQUE SPARSE index. Sparse
 * only leaves out documents that are missing the field — a document whose field
 * is explicitly null is still indexed. `legacyBannerId` is declared with
 * `default: null`, so every banner created from the admin App Content drawer
 * stores an explicit null: the first one claimed the null slot and every banner
 * created after it failed with E11000 duplicate key, which createAppBanner
 * catches and reports as a plain 500 "Internal server error".
 *
 * The schema now declares the same key as a UNIQUE PARTIAL index limited to
 * documents where legacyBannerId is a real ObjectId. MongoDB cannot change an
 * existing index's options in place and Mongoose's autoIndex would only log an
 * IndexOptionsConflict and leave the broken index alone, so the old index has
 * to be dropped explicitly. Run once against each environment before (or right
 * after) deploying the model change:
 *
 *   node scripts/fixAppBannerLegacyIndex.js
 *
 * Safe to re-run: it does nothing if the partial index is already in place.
 */

const mongoose = require("mongoose");
require("dotenv").config();

const INDEX_NAME = "legacyBannerId_1";
const PARTIAL_FILTER = { legacyBannerId: { $type: "objectId" } };

async function fixAppBannerLegacyIndex() {
  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!uri) {
    console.error("✗ No DATABASE_URL / MONGODB_URI in the environment.");
    process.exitCode = 1;
    return;
  }

  try {
    await mongoose.connect(uri);
    const collection = mongoose.connection.db.collection("appbanners");
    const existing = (await collection.indexes()).find((i) => i.name === INDEX_NAME);

    if (existing?.partialFilterExpression) {
      console.log("✓ Nothing to do — the partial index is already in place.");
      return;
    }

    // A duplicate among the real ObjectId values would make the unique create
    // fail halfway; surface it as a readable message instead.
    const duplicates = await collection
      .aggregate([
        { $match: PARTIAL_FILTER },
        { $group: { _id: "$legacyBannerId", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    if (duplicates.length) {
      console.error(
        `✗ ${duplicates.length} legacyBannerId value(s) are used by more than one AppBanner — ` +
          "resolve these before the unique index can be rebuilt:"
      );
      duplicates.forEach((d) => console.error(`   ${d._id} ×${d.count}`));
      process.exitCode = 1;
      return;
    }

    if (existing) {
      await collection.dropIndex(INDEX_NAME);
      console.log(`✓ Dropped the old sparse index ${INDEX_NAME}`);
    }

    await collection.createIndex(
      { legacyBannerId: 1 },
      { unique: true, partialFilterExpression: PARTIAL_FILTER, name: INDEX_NAME }
    );

    const nulls = await collection.countDocuments({ legacyBannerId: null });
    console.log(`✓ Created the unique partial index ${INDEX_NAME}`);
    console.log(`  ${nulls} banner(s) with a null legacyBannerId are now outside the constraint.`);
  } catch (error) {
    console.error("Error repairing the AppBanner legacyBannerId index:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

if (require.main === module) {
  fixAppBannerLegacyIndex();
}

module.exports = fixAppBannerLegacyIndex;
