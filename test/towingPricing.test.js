// Unit tests for the towing-charge half of the pricing engine. Pure — no DB,
// no HTTP; run with `npm test`.
const assert = require("assert");
const {
  BIKE_CONDITIONS,
  PricingError,
  computePriceBreakdown,
  isTowingRequired,
  normalizeBikeCondition,
  resolveTowingCharge,
} = require("../services/pricingEngine");

const dealer = {
  tax: 18,
  commission: 10,
  pickupCharges: 100,
  dropCharges: 50,
  providesPickup: true,
  providesDrop: true,
  providesTowing: true,
  towingCharges: 300,
};

// ── Condition → towing requirement ──────────────────────────────────────────
assert.strictEqual(normalizeBikeCondition(undefined), BIKE_CONDITIONS.RIDEABLE);
assert.strictEqual(normalizeBikeCondition(""), BIKE_CONDITIONS.RIDEABLE);
assert.strictEqual(normalizeBikeCondition("not_rideable"), BIKE_CONDITIONS.NOT_RIDEABLE);
assert.throws(() => normalizeBikeCondition("FLYING"), PricingError);

assert.strictEqual(isTowingRequired(undefined), false);
assert.strictEqual(isTowingRequired(BIKE_CONDITIONS.RIDEABLE), false);
assert.strictEqual(isTowingRequired(BIKE_CONDITIONS.NOT_RIDEABLE), true);
assert.strictEqual(isTowingRequired(BIKE_CONDITIONS.COMPLETELY_DEAD), true);

// ── Charge resolution ───────────────────────────────────────────────────────
assert.strictEqual(resolveTowingCharge({ towingRequired: false, dealer }), 0);
assert.strictEqual(resolveTowingCharge({ towingRequired: true, dealer }), 300);
// A dealer who doesn't offer towing starts at 0 — the booking isn't blocked.
assert.strictEqual(
  resolveTowingCharge({ towingRequired: true, dealer: { ...dealer, providesTowing: false } }),
  0
);
// An override (dealer/admin editing the booking) wins, including 0.
assert.strictEqual(resolveTowingCharge({ towingRequired: true, dealer, override: 450 }), 450);
assert.strictEqual(resolveTowingCharge({ towingRequired: true, dealer, override: 0 }), 0);
// …but never on a booking that doesn't need towing.
assert.strictEqual(resolveTowingCharge({ towingRequired: false, dealer, override: 450 }), 0);
assert.throws(() => resolveTowingCharge({ towingRequired: true, dealer, override: -1 }), PricingError);
assert.throws(() => resolveTowingCharge({ towingRequired: true, dealer, override: 1e9 }), PricingError);

// ── Rideable booking: unchanged from before the feature ─────────────────────
const rideable = computePriceBreakdown({
  serviceAmount: 1000,
  transportOption: "SELF_VISIT",
  dealer,
});
assert.strictEqual(rideable.bikeCondition, BIKE_CONDITIONS.RIDEABLE);
assert.strictEqual(rideable.towingRequired, false);
assert.strictEqual(rideable.towingCharge, 0);
assert.strictEqual(rideable.subtotal, 1000);
assert.strictEqual(rideable.taxAmount, 180);
assert.strictEqual(rideable.customerTotal, 1180);

// A client that never sends bikeCondition must get the identical breakdown.
assert.deepStrictEqual(
  computePriceBreakdown({ serviceAmount: 1000, transportOption: "SELF_VISIT", dealer, bikeCondition: "RIDEABLE" }),
  rideable
);

// ── Towing required: charge joins the subtotal, so tax + commission follow ──
const towed = computePriceBreakdown({
  serviceAmount: 1000,
  transportOption: "SELF_VISIT",
  dealer,
  bikeCondition: BIKE_CONDITIONS.NOT_RIDEABLE,
});
assert.strictEqual(towed.towingRequired, true);
assert.strictEqual(towed.towingCharge, 300);
assert.strictEqual(towed.subtotal, 1300);          // 1000 + 300
assert.strictEqual(towed.taxAmount, 234);          // 18% of 1300
assert.strictEqual(towed.customerTotal, 1534);
assert.strictEqual(towed.commissionAmount, 130);   // 10% of 1300
assert.strictEqual(towed.dealerEarnings, 1170);

// Completely dead behaves the same as not rideable.
const dead = computePriceBreakdown({
  serviceAmount: 1000,
  transportOption: "SELF_VISIT",
  dealer,
  bikeCondition: BIKE_CONDITIONS.COMPLETELY_DEAD,
});
assert.strictEqual(dead.towingCharge, 300);
assert.strictEqual(dead.customerTotal, 1534);

// ── Towing stacks with pickup/drop rather than replacing them ───────────────
const full = computePriceBreakdown({
  serviceAmount: 1000,
  transportOption: "PICKUP_AND_DROP",
  dealer,
  bikeCondition: BIKE_CONDITIONS.COMPLETELY_DEAD,
});
assert.strictEqual(full.pickupCharges, 100);
assert.strictEqual(full.dropCharges, 50);
assert.strictEqual(full.towingCharge, 300);
assert.strictEqual(full.subtotal, 1450);
assert.strictEqual(full.customerTotal, 1711);      // 1450 + 18%

// ── Dealer/admin revising the charge on an existing booking ────────────────
const revised = computePriceBreakdown({
  serviceAmount: 1000,
  transportOption: "SELF_VISIT",
  dealer,
  bikeCondition: BIKE_CONDITIONS.NOT_RIDEABLE,
  towingChargeOverride: 500,
});
assert.strictEqual(revised.towingCharge, 500);
assert.strictEqual(revised.subtotal, 1500);
assert.strictEqual(revised.customerTotal, 1770);

// An invalid condition is rejected rather than silently priced as rideable.
assert.throws(
  () => computePriceBreakdown({ serviceAmount: 1000, transportOption: "SELF_VISIT", dealer, bikeCondition: "BROKEN" }),
  PricingError
);

console.log("Towing pricing tests passed");
