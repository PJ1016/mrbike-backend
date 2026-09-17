const assert = require("assert");
const {
  NULLISH_WALLET_FILTER,
  shouldNormalizeWallet,
  normalizeWalletValue,
} = require("../helper/dealerWalletNormalization");

assert.deepStrictEqual(NULLISH_WALLET_FILTER, {
  $or: [{ wallet: { $exists: false } }, { wallet: null }],
});

assert.strictEqual(shouldNormalizeWallet({}), true);
assert.strictEqual(shouldNormalizeWallet({ wallet: null }), true);
assert.strictEqual(normalizeWalletValue({}), 0);
assert.strictEqual(normalizeWalletValue({ wallet: null }), 0);

for (const balance of [0, 250, -111, -499, -500, -900]) {
  assert.strictEqual(shouldNormalizeWallet({ wallet: balance }), false);
  assert.strictEqual(normalizeWalletValue({ wallet: balance }), balance);
}

console.log("dealerWalletNormalization.test.js — all assertions passed");
