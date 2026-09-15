// Unit tests for GST on MR Bike's commission. Pure — no DB, no HTTP.
//
// The invariant: this tax is charged BY the platform TO the dealer. It comes
// out of the dealer's payout and must never move the customer's total.
const assert = require("assert");
const {
  MAX_COMMISSION_TAX_RATE,
  PricingError,
  computePriceBreakdown,
  resolveCommissionTaxRate,
} = require("../services/pricingEngine");

const dealer = { tax: 0, commission: 10, providesPickup: true, providesDrop: true };

// ── Rate resolution ─────────────────────────────────────────────────────────
assert.strictEqual(resolveCommissionTaxRate({}), 0, "no rate configured means no tax");
assert.strictEqual(resolveCommissionTaxRate({ commissionTaxRate: 18 }), 18);
// An override (an existing booking replaying its own frozen rate) wins,
// including 0 — that is how bookings predating the tax stay untaxed.
assert.strictEqual(resolveCommissionTaxRate({ commissionTaxRate: 18, override: 5 }), 5);
assert.strictEqual(resolveCommissionTaxRate({ commissionTaxRate: 18, override: 0 }), 0);
assert.throws(() => resolveCommissionTaxRate({ commissionTaxRate: -1 }), PricingError);
assert.throws(
  () => resolveCommissionTaxRate({ commissionTaxRate: MAX_COMMISSION_TAX_RATE + 1 }),
  PricingError
);

// ── The CA's worked example: ₹1000 bill, 10% commission, 18% GST on it ──────
const b = computePriceBreakdown({
  serviceAmount: 1000,
  transportOption: "SELF_VISIT",
  dealer,
  commissionTaxRate: 18,
});
assert.strictEqual(b.subtotal, 1000);
assert.strictEqual(b.commissionAmount, 100);
assert.strictEqual(b.commissionTaxRate, 18);
assert.strictEqual(b.commissionTaxAmount, 18);
assert.strictEqual(b.commissionTotal, 118, "₹118 is what leaves the dealer");
assert.strictEqual(b.dealerEarnings, 882, "1000 − 118");

// ── The customer pays exactly the same either way ───────────────────────────
const untaxed = computePriceBreakdown({
  serviceAmount: 1000,
  transportOption: "SELF_VISIT",
  dealer: { ...dealer, tax: 5 },
});
const taxed = computePriceBreakdown({
  serviceAmount: 1000,
  transportOption: "SELF_VISIT",
  dealer: { ...dealer, tax: 5 },
  commissionTaxRate: 18,
});
assert.strictEqual(taxed.customerTotal, untaxed.customerTotal, "commission GST never reaches the customer");
assert.strictEqual(taxed.subtotal, untaxed.subtotal);
assert.strictEqual(taxed.taxAmount, untaxed.taxAmount, "…and is not the customer's tax line");
assert.strictEqual(taxed.commissionAmount, untaxed.commissionAmount);
// It comes out of the dealer instead.
assert.strictEqual(untaxed.dealerEarnings - taxed.dealerEarnings, taxed.commissionTaxAmount);

// ── An existing booking keeps the rate it was created with ──────────────────
const recomputed = computePriceBreakdown({
  serviceAmount: 1200,
  transportOption: "SELF_VISIT",
  dealer,
  commissionTaxRate: 28, // a later statutory change…
  commissionTaxRateOverride: b.commissionTaxRate, // …must not reach this booking
});
assert.strictEqual(recomputed.commissionTaxRate, 18);

// A booking created before the tax existed recomputes untaxed.
const legacy = computePriceBreakdown({
  serviceAmount: 1200,
  transportOption: "SELF_VISIT",
  dealer,
  commissionTaxRate: 18,
  commissionTaxRateOverride: 0,
});
assert.strictEqual(legacy.commissionTaxAmount, 0);
assert.strictEqual(legacy.dealerEarnings, 1080, "1200 − 120 commission, no GST");

// ── Platform fee and commission GST are independent of each other ───────────
const both = computePriceBreakdown({
  serviceAmount: 1000,
  transportOption: "SELF_VISIT",
  dealer,
  commissionTaxRate: 18,
  platformFeeConfig: { enabled: true, amount: 20, label: "Platform Fee" },
});
assert.strictEqual(both.customerTotal, 1020, "customer pays subtotal + platform fee");
assert.strictEqual(both.dealerEarnings, 882, "platform fee does not touch the payout");
assert.strictEqual(both.commissionTotal, 118, "…and the platform fee is not commissioned or taxed here");

console.log("Commission tax pricing tests passed");
