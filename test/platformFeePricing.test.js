// Unit tests for the platform/convenience-fee half of the pricing engine.
// Pure — no DB, no HTTP; run with `npm test`.
//
// The invariant every assertion here exists to protect: the platform fee is
// MR Bike's charge, not the garage's, so it reaches customerTotal and nothing
// else — never subtotal, never the tax base, never commission or earnings.
const assert = require("assert");
const {
  MAX_PLATFORM_FEE,
  PricingError,
  computePriceBreakdown,
  resolvePlatformFee,
} = require("../services/pricingEngine");

const dealer = {
  tax: 5,
  commission: 10,
  pickupCharges: 50,
  dropCharges: 0,
  providesPickup: true,
  providesDrop: true,
  providesTowing: true,
  towingCharges: 300,
};

const enabled = { enabled: true, amount: 20, label: "Convenience Fee" };
const disabled = { enabled: false, amount: 20, label: "Convenience Fee" };

// ── Fee resolution ──────────────────────────────────────────────────────────
assert.strictEqual(resolvePlatformFee({}), 0, "no config at all means no fee");
assert.strictEqual(resolvePlatformFee({ platformFeeConfig: disabled }), 0);
assert.strictEqual(resolvePlatformFee({ platformFeeConfig: enabled }), 20);
// An override (an existing booking replaying its own frozen fee) wins,
// including 0 — that is how legacy bookings stay at 0 forever.
assert.strictEqual(resolvePlatformFee({ platformFeeConfig: enabled, override: 35 }), 35);
assert.strictEqual(resolvePlatformFee({ platformFeeConfig: enabled, override: 0 }), 0);
assert.throws(() => resolvePlatformFee({ override: -1 }), PricingError);
assert.throws(() => resolvePlatformFee({ override: MAX_PLATFORM_FEE + 1 }), PricingError);

// ── Fee off: byte-for-byte the pricing that existed before the feature ──────
const withoutFee = computePriceBreakdown({
  serviceAmount: 450,
  transportOption: "PICKUP_ONLY",
  dealer,
  bikeCondition: "NOT_RIDEABLE",
});
assert.strictEqual(withoutFee.subtotal, 800);
assert.strictEqual(withoutFee.taxAmount, 40);
assert.strictEqual(withoutFee.platformFee, 0);
assert.strictEqual(withoutFee.platformFeeLabel, null, "no label without a fee");
assert.strictEqual(withoutFee.customerTotal, 840);

// ── Fee on: it lands on customerTotal and nowhere else ──────────────────────
const withFee = computePriceBreakdown({
  serviceAmount: 450,
  transportOption: "PICKUP_ONLY",
  dealer,
  bikeCondition: "NOT_RIDEABLE",
  platformFeeConfig: enabled,
});
assert.strictEqual(withFee.subtotal, withoutFee.subtotal, "fee is outside the subtotal");
assert.strictEqual(withFee.taxAmount, withoutFee.taxAmount, "fee is never taxed");
assert.strictEqual(withFee.commissionAmount, withoutFee.commissionAmount, "fee is not commissionable");
assert.strictEqual(withFee.dealerEarnings, withoutFee.dealerEarnings, "fee never reaches the dealer");
assert.strictEqual(withFee.platformFee, 20);
assert.strictEqual(withFee.platformFeeLabel, "Convenience Fee");
assert.strictEqual(withFee.customerTotal, 860);

// The admin's default label is used when they left the field blank.
const blankLabel = computePriceBreakdown({
  serviceAmount: 450,
  transportOption: "SELF_VISIT",
  dealer,
  platformFeeConfig: { enabled: true, amount: 20, label: "   " },
});
assert.strictEqual(blankLabel.platformFeeLabel, "Platform Fee");

// ── A promo never discounts the fee away ────────────────────────────────────
const promo = {
  code: "FLAT100",
  name: "Flat 100 off",
  isActive: true,
  discountType: "flat",
  discountValue: 100,
};
const withPromo = computePriceBreakdown({
  serviceAmount: 450,
  transportOption: "PICKUP_ONLY",
  dealer,
  bikeCondition: "NOT_RIDEABLE",
  platformFeeConfig: enabled,
  promo,
});
assert.strictEqual(withPromo.promoDiscountAmount, 100, "discount is taken off the subtotal");
assert.strictEqual(withPromo.platformFee, 20, "…and never off the platform fee");
// What the customer pays: customerTotal (860) - discount (100).
assert.strictEqual(withPromo.customerTotal - withPromo.discountAmount, 760);

// ── An existing booking keeps the fee it was created with ───────────────────
// This is what every recompute path does (a changed service list, a revised
// towing charge): the admin's current setting is ignored in favour of the
// booking's own stored fee, so old bookings are never re-priced.
const recomputed = computePriceBreakdown({
  serviceAmount: 600,
  transportOption: "PICKUP_ONLY",
  dealer,
  bikeCondition: "NOT_RIDEABLE",
  platformFeeConfig: { enabled: true, amount: 99, label: "Raised Later" },
  platformFeeOverride: withFee.platformFee,
  platformFeeLabelOverride: withFee.platformFeeLabel,
});
assert.strictEqual(recomputed.platformFee, 20);
assert.strictEqual(recomputed.platformFeeLabel, "Convenience Fee");

// A booking created before the fee existed recomputes at 0, not at the
// admin's current amount.
const legacyRecompute = computePriceBreakdown({
  serviceAmount: 600,
  transportOption: "SELF_VISIT",
  dealer,
  platformFeeConfig: enabled,
  platformFeeOverride: 0,
  platformFeeLabelOverride: null,
});
assert.strictEqual(legacyRecompute.platformFee, 0);
assert.strictEqual(legacyRecompute.platformFeeLabel, null);

console.log("Platform fee pricing tests passed");
