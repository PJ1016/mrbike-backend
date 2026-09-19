const assert = require("assert");
const {
  calculateMrBikeMoneyRedemption,
  getServiceRedemptionLimit,
} = require("../services/mrBikeMoneyService");

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test("caps redemption by wallet balance", () => {
  const result = calculateMrBikeMoneyRedemption({ balance: 75, serviceLimit: 100, amountDueBeforeMoney: 500 });
  assert.strictEqual(result.maxRedeemable, 75);
});

test("caps redemption by the combined service limit", () => {
  const result = calculateMrBikeMoneyRedemption({ balance: 500, serviceLimit: 120, amountDueBeforeMoney: 900 });
  assert.strictEqual(result.maxRedeemable, 120);
});

test("never discounts below zero after promo", () => {
  const result = calculateMrBikeMoneyRedemption({ balance: 500, serviceLimit: 500, amountDueBeforeMoney: 42.5 });
  assert.strictEqual(result.maxRedeemable, 42.5);
});

test("sums limits across selected services", () => {
  const result = getServiceRedemptionLimit([
    { base_service_id: { mrBikeMoneyMaxRedeem: 50 } },
    { base_service_id: { mrBikeMoneyMaxRedeem: 25.5 } },
    { base_service_id: null },
  ]);
  assert.strictEqual(result, 75.5);
});

console.log("MR Bike Money tests passed");
