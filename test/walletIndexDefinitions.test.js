const assert = require("assert");
const Wallet = require("../models/Wallet_modal");

const ordinaryWallet = new Wallet({ orderId: "ordinary-wallet-row" });
const ordinaryObject = ordinaryWallet.toObject();
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(ordinaryObject, "rollback_of"),
  false,
  "ordinary wallet rows must omit rollback_of so legacy sparse indexes do not index null",
);
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(ordinaryObject, "idempotency_key"),
  false,
  "wallet rows without an idempotency key must omit it so legacy sparse indexes do not index null",
);

const indexes = new Map(Wallet.schema.indexes().map(([key, options]) => [options.name, { key, options }]));

const rollback = indexes.get("one_wallet_rollback_per_source_transaction");
assert.ok(rollback, "rollback uniqueness index should be declared");
assert.strictEqual(rollback.options.unique, true);
assert.strictEqual(rollback.options.sparse, undefined);
assert.deepStrictEqual(rollback.options.partialFilterExpression, {
  rollback_of: { $type: "objectId" },
});

const idempotency = indexes.get("one_wallet_request_per_dealer_idempotency_key");
assert.ok(idempotency, "idempotency uniqueness index should be declared");
assert.strictEqual(idempotency.options.unique, true);
assert.strictEqual(idempotency.options.sparse, undefined);
assert.deepStrictEqual(idempotency.options.partialFilterExpression, {
  idempotency_key: { $type: "string" },
});

console.log("walletIndexDefinitions.test.js: all tests passed");
