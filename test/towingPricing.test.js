// Unit tests for the towing-charge half of the pricing engine. Pure — no DB,
// no HTTP; run with `npm test`.
const assert = require("assert");
const {
  BIKE_CONDITIONS,
  PricingError,
  computePriceBreakdown,
  isTowingRequired,
  transportNeedsTowing,
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

// Towing takes a non-rideable bike AND the garage being the one to collect it.
assert.strictEqual(isTowingRequired(undefined, "PICKUP_ONLY"), false);
assert.strictEqual(isTowingRequired(BIKE_CONDITIONS.RIDEABLE, "PICKUP_ONLY"), false);
assert.strictEqual(isTowingRequired(BIKE_CONDITIONS.NOT_RIDEABLE, "PICKUP_ONLY"), true);
assert.strictEqual(isTowingRequired(BIKE_CONDITIONS.COMPLETELY_DEAD, "PICKUP_ONLY"), true);
assert.strictEqual(isTowingRequired(BIKE_CONDITIONS.COMPLETELY_DEAD, "PICKUP_AND_DROP"), true);
// …the customer bringing the bike in themselves is never towed by the garage.
assert.strictEqual(isTowingRequired(BIKE_CONDITIONS.NOT_RIDEABLE, "SELF_VISIT"), false);
assert.strictEqual(isTowingRequired(BIKE_CONDITIONS.COMPLETELY_DEAD, "SELF_VISIT"), false);
assert.strictEqual(isTowingRequired(BIKE_CONDITIONS.COMPLETELY_DEAD, "DROP_ONLY"), false);
assert.strictEqual(isTowingRequired(BIKE_CONDITIONS.NOT_RIDEABLE, undefined), false);

assert.strictEqual(transportNeedsTowing("PICKUP_ONLY"), true);
assert.strictEqual(transportNeedsTowing("PICKUP_AND_DROP"), true);
assert.strictEqual(transportNeedsTowing("SELF_VISIT"), false);
assert.strictEqual(transportNeedsTowing("DROP_ONLY"), false);

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
// PICKUP_ONLY minus the dealer's ₹100 pickup fee is the 1000 + 300 case below.
const towed = computePriceBreakdown({
  serviceAmount: 1000,
  transportOption: "PICKUP_ONLY",
  dealer: { ...dealer, pickupCharges: 0 },
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
  transportOption: "PICKUP_ONLY",
  dealer: { ...dealer, pickupCharges: 0 },
  bikeCondition: BIKE_CONDITIONS.COMPLETELY_DEAD,
});
assert.strictEqual(dead.towingCharge, 300);
assert.strictEqual(dead.customerTotal, 1534);

// ── The customer brings the dead bike in themselves: nothing to tow ─────────
// The bug this guards: a NOT_RIDEABLE + SELF_VISIT booking used to be quoted
// "Towing: Required" and charged the dealer's full towing rate even though the
// garage never collected the bike.
for (const option of ["SELF_VISIT", "DROP_ONLY"]) {
  for (const condition of [BIKE_CONDITIONS.NOT_RIDEABLE, BIKE_CONDITIONS.COMPLETELY_DEAD]) {
    const selfBrought = computePriceBreakdown({
      serviceAmount: 1000,
      transportOption: option,
      dealer: { ...dealer, dropCharges: 0 },
      bikeCondition: condition,
    });
    assert.strictEqual(selfBrought.towingRequired, false, `${option}/${condition} towingRequired`);
    assert.strictEqual(selfBrought.towingCharge, 0, `${option}/${condition} towingCharge`);
    assert.strictEqual(selfBrought.subtotal, 1000);
    assert.strictEqual(selfBrought.customerTotal, 1180);   // 1000 + 18%, no towing
  }
}

// PICKUP_AND_DROP still tows: pickup 100 + drop 50 + towing 300.
const pickedUp = computePriceBreakdown({
  serviceAmount: 1000,
  transportOption: "PICKUP_AND_DROP",
  dealer,
  bikeCondition: BIKE_CONDITIONS.NOT_RIDEABLE,
});
assert.strictEqual(pickedUp.towingRequired, true);
assert.strictEqual(pickedUp.towingCharge, 300);

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
  transportOption: "PICKUP_ONLY",
  dealer: { ...dealer, pickupCharges: 0 },
  bikeCondition: BIKE_CONDITIONS.NOT_RIDEABLE,
  towingChargeOverride: 500,
});
assert.strictEqual(revised.towingCharge, 500);
assert.strictEqual(revised.subtotal, 1500);
assert.strictEqual(revised.customerTotal, 1770);

// A booking created under the old rule (self-visit + dead bike, towing charged)
// keeps its towing when it is recomputed — the snapshot is replayed, not
// re-derived, so an edited service list never silently voids an agreed charge.
const legacyRecompute = computePriceBreakdown({
  serviceAmount: 1000,
  transportOption: "SELF_VISIT",
  dealer,
  bikeCondition: BIKE_CONDITIONS.NOT_RIDEABLE,
  towingRequiredOverride: true,
  towingChargeOverride: 300,
});
assert.strictEqual(legacyRecompute.towingRequired, true);
assert.strictEqual(legacyRecompute.towingCharge, 300);
assert.strictEqual(legacyRecompute.customerTotal, 1534);

// …and an override of false is honoured just as literally.
const clearedRecompute = computePriceBreakdown({
  serviceAmount: 1000,
  transportOption: "PICKUP_ONLY",
  dealer: { ...dealer, pickupCharges: 0 },
  bikeCondition: BIKE_CONDITIONS.NOT_RIDEABLE,
  towingRequiredOverride: false,
  towingChargeOverride: 300,
});
assert.strictEqual(clearedRecompute.towingRequired, false);
assert.strictEqual(clearedRecompute.towingCharge, 0);

// An invalid condition is rejected rather than silently priced as rideable.
assert.throws(
  () => computePriceBreakdown({ serviceAmount: 1000, transportOption: "SELF_VISIT", dealer, bikeCondition: "BROKEN" }),
  PricingError
);

console.log("Towing pricing tests passed");
