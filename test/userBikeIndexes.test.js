const assert = require("assert");
const { ensureUserBikePlateIndexes } = require("../utils/userBikeIndexes");

function fakeDatabase(initialIndexes) {
  const state = {
    indexes: initialIndexes.map((index) => ({ ...index, key: { ...index.key } })),
    calls: [],
  };

  return {
    state,
    collection(name) {
      assert.strictEqual(name, "userbikes");
      return {
        async indexes() {
          return state.indexes;
        },
        async createIndex(key, options) {
          state.calls.push(["create", key, options]);
          state.indexes.push({ name: options.name, key, unique: options.unique });
          return options.name;
        },
        async dropIndex(nameToDrop) {
          state.calls.push(["drop", nameToDrop]);
          state.indexes = state.indexes.filter((index) => index.name !== nameToDrop);
        },
      };
    },
  };
}

async function run() {
  const legacyDb = fakeDatabase([
    { name: "_id_", key: { _id: 1 }, unique: true },
    { name: "custom_global_plate", key: { plate_number: 1 }, unique: true },
  ]);

  const repaired = await ensureUserBikePlateIndexes(legacyDb);
  assert.strictEqual(repaired.createdPerUserIndex, true);
  assert.deepStrictEqual(repaired.droppedGlobalIndexes, ["custom_global_plate"]);
  assert.deepStrictEqual(legacyDb.state.calls.map((call) => call[0]), ["create", "drop"]);
  assert.ok(
    legacyDb.state.indexes.some(
      (index) => index.unique && index.key.user_id === 1 && index.key.plate_number === 1,
    ),
  );
  assert.ok(!legacyDb.state.indexes.some((index) => index.name === "custom_global_plate"));

  const secondRun = await ensureUserBikePlateIndexes(legacyDb);
  assert.deepStrictEqual(secondRun, {
    createdPerUserIndex: false,
    droppedGlobalIndexes: [],
  });
  assert.deepStrictEqual(legacyDb.state.calls.map((call) => call[0]), ["create", "drop"]);

  console.log("✓ UserBike plate uniqueness is per user and legacy global indexes are removed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
