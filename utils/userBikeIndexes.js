const LEGACY_INDEX_NAME = "plate_number_1";
const PER_USER_INDEX_NAME = "user_id_1_plate_number_1";

function hasExactKeys(index, expectedKeys) {
  const actualEntries = Object.entries(index?.key || {});
  const expectedEntries = Object.entries(expectedKeys);

  return (
    actualEntries.length === expectedEntries.length &&
    actualEntries.every(
      ([field, direction], position) =>
        field === expectedEntries[position][0] && direction === expectedEntries[position][1],
    )
  );
}

/**
 * Keep registration-number uniqueness inside one customer's garage.
 *
 * Mongoose creates newly declared indexes, but it does not remove indexes that
 * disappeared from a schema. Older databases therefore retain the global
 * `{ plate_number: 1 }` unique index until it is explicitly removed.
 */
async function ensureUserBikePlateIndexes(database) {
  const collection = database.collection("userbikes");
  let indexes;
  try {
    indexes = await collection.indexes();
  } catch (error) {
    // A brand-new database has no userbikes namespace yet. createIndex below
    // creates the collection as well, so startup remains safe on fresh installs.
    if (error?.code !== 26 && error?.codeName !== "NamespaceNotFound") throw error;
    indexes = [];
  }

  const perUserIndex = indexes.find(
    (index) => index.unique === true && hasExactKeys(index, { user_id: 1, plate_number: 1 }),
  );

  if (!perUserIndex) {
    const nonUniquePerUserIndex = indexes.find((index) =>
      hasExactKeys(index, { user_id: 1, plate_number: 1 }),
    );
    if (nonUniquePerUserIndex) await collection.dropIndex(nonUniquePerUserIndex.name);

    await collection.createIndex(
      { user_id: 1, plate_number: 1 },
      { unique: true, name: PER_USER_INDEX_NAME },
    );
    indexes = await collection.indexes();
  }

  // Match by key definition as well as the conventional name. This also
  // repairs databases where the legacy index was created with a custom name.
  const globalPlateIndexes = indexes.filter(
    (index) =>
      index.unique === true &&
      (index.name === LEGACY_INDEX_NAME || hasExactKeys(index, { plate_number: 1 })),
  );

  for (const index of globalPlateIndexes) {
    await collection.dropIndex(index.name);
  }

  return {
    createdPerUserIndex: !perUserIndex,
    droppedGlobalIndexes: globalPlateIndexes.map((index) => index.name),
  };
}

module.exports = {
  LEGACY_INDEX_NAME,
  PER_USER_INDEX_NAME,
  ensureUserBikePlateIndexes,
};
