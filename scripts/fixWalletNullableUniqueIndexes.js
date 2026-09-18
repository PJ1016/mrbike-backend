/**
 * Repair wallet unique indexes whose optional keys may be explicitly null.
 *
 * A sparse index excludes missing fields, but it still indexes fields stored as
 * null. Wallet documents use null defaults for rollback_of and idempotency_key,
 * so unique sparse indexes allow only one ordinary wallet row with each null
 * value. Partial indexes restrict uniqueness to real rollback/idempotency keys.
 *
 * Run once in each environment after deploying the matching schema change:
 *
 *   npm run repair:wallet-indexes
 *
 * Safe to re-run. No wallet documents are modified.
 */

const mongoose = require("mongoose");
require("dotenv").config();

const INDEXES = [
  {
    name: "one_wallet_request_per_dealer_idempotency_key",
    key: { dealer_id: 1, idempotency_key: 1 },
    partialFilterExpression: { idempotency_key: { $type: "string" } },
    duplicateField: "idempotency_key",
    duplicateMatch: { idempotency_key: { $type: "string" } },
    duplicateGroupId: { dealer_id: "$dealer_id", idempotency_key: "$idempotency_key" },
  },
  {
    name: "one_wallet_rollback_per_source_transaction",
    key: { rollback_of: 1 },
    partialFilterExpression: { rollback_of: { $type: "objectId" } },
    duplicateField: "rollback_of",
    duplicateMatch: { rollback_of: { $type: "objectId" } },
    duplicateGroupId: "$rollback_of",
  },
];

function samePartialFilter(actual, expected) {
  return JSON.stringify(actual || null) === JSON.stringify(expected);
}

async function repairIndex(collection, definition) {
  const existing = (await collection.indexes()).find((index) => index.name === definition.name);
  if (existing && samePartialFilter(existing.partialFilterExpression, definition.partialFilterExpression)) {
    console.log(`✓ ${definition.name} is already correct`);
    return;
  }

  const duplicates = await collection
    .aggregate([
      { $match: definition.duplicateMatch },
      { $group: { _id: definition.duplicateGroupId, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 20 },
    ])
    .toArray();

  if (duplicates.length) {
    const error = new Error(
      `${definition.name} cannot be rebuilt: duplicate ${definition.duplicateField} values exist: ` +
        duplicates.map((item) => `${JSON.stringify(item._id)} x${item.count}`).join(", ")
    );
    error.code = "WALLET_INDEX_DUPLICATES";
    throw error;
  }

  if (existing) {
    await collection.dropIndex(definition.name);
    console.log(`✓ Dropped old index ${definition.name}`);
  }

  await collection.createIndex(definition.key, {
    unique: true,
    partialFilterExpression: definition.partialFilterExpression,
    name: definition.name,
  });
  console.log(`✓ Created partial unique index ${definition.name}`);
}

async function fixWalletNullableUniqueIndexes() {
  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("No DATABASE_URL / MONGODB_URI in the environment");
  }

  try {
    await mongoose.connect(uri);
    const collection = mongoose.connection.db.collection("wallets");
    for (const definition of INDEXES) {
      await repairIndex(collection, definition);
    }
  } finally {
    await mongoose.connection.close();
  }
}

if (require.main === module) {
  fixWalletNullableUniqueIndexes().catch((error) => {
    console.error("Error repairing wallet nullable unique indexes:", error);
    process.exitCode = 1;
  });
}

module.exports = { fixWalletNullableUniqueIndexes, repairIndex, INDEXES };
