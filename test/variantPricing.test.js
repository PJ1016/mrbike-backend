const assert = require("assert");
const { resolvePriceForCC, resolveServiceAmount } = require("../services/pricingEngine");

const MODEL = "6a6f03898dd53a371f0c3b2e";
const APACHI_RTR = "6aaac7af82bb2014ad592793";
const OTHER_200 = "6aaac7af82bb2014ad592794";

const exactOnly = {
  bikes: [
    { model_id: MODEL, variant_id: APACHI_RTR, cc: 200, price: 500 },
    { model_id: MODEL, variant_id: OTHER_200, cc: 200, price: 650 },
  ],
};

assert.strictEqual(
  resolvePriceForCC(exactOnly, 200, { modelId: MODEL, variantId: APACHI_RTR }),
  500,
);
assert.strictEqual(
  resolvePriceForCC(exactOnly, 200, { modelId: MODEL, variantId: OTHER_200 }),
  650,
);
assert.strictEqual(
  resolvePriceForCC(exactOnly, 200, { modelId: MODEL, variantId: "6aaac7af82bb2014ad592799" }),
  0,
);

// A deliberate generic row remains a valid fallback and is never deleted.
const withGeneric = {
  bikes: [
    ...exactOnly.bikes,
    { model_id: null, variant_id: null, cc: 200, price: 700 },
  ],
};
assert.strictEqual(
  resolvePriceForCC(withGeneric, 200, { modelId: MODEL, variantId: "6aaac7af82bb2014ad592799" }),
  700,
);
assert.strictEqual(
  resolveServiceAmount({
    services: [exactOnly],
    bikeCC: 200,
    bikeContext: { modelId: MODEL, variantId: APACHI_RTR },
  }),
  500,
);

// Legacy integrations that genuinely have no selected-bike context retain the
// old CC-only behavior; User App quote/booking paths now always send context.
assert.strictEqual(resolvePriceForCC(exactOnly, 200), 500);

console.log("variantPricing.test.js passed");
