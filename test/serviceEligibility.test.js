// Unit tests for the shared bike-aware eligibility rules
// (v1-api/helpers/serviceEligibility.js). Pure — no DB, no HTTP; run with
// `npm test`.
//
// The business rule under test:
//   DISCOVERY = ALL SAVED BIKES   (union across the rider's garage)
//   BOOKING   = ONE SELECTED BIKE (that bike only, no fallback)
const assert = require("assert");
const {
  toBikeContext,
  normalizeIdList,
  dealerScopeBaseFilter,
  adminServiceScopeFilter,
  adminServiceSupportsBike,
  matchingBikeContexts,
  resolveIndicativePrice,
  buildScope,
  buildServiceEligibilityIndex,
  buildGarageEntries,
} = require("../v1-api/helpers/serviceEligibility");

// ── Fixtures ────────────────────────────────────────────────────────────────
const HONDA = "6512c0000000000000000001";
const HERO = "6512c0000000000000000002";

const M1 = "6512d0000000000000000001";
const M2 = "6512d0000000000000000002";
const M3 = "6512d0000000000000000003";
const M9 = "6512d0000000000000000009";

const V1 = "6512e0000000000000000001";
const V2 = "6512e0000000000000000002";
const V3 = "6512e0000000000000000003";
const V9 = "6512e0000000000000000009";

const D1 = "6512f0000000000000000001";
const D2 = "6512f0000000000000000002";
const D3 = "6512f0000000000000000003";

// The rider's garage: three bikes, two brands.
const BIKE_A = { bikeId: "bikeA", companyId: HONDA, modelId: M1, variantId: V1, cc: 110 };
const BIKE_B = { bikeId: "bikeB", companyId: HONDA, modelId: M2, variantId: V2, cc: 150 };
const BIKE_C = { bikeId: "bikeC", companyId: HERO, modelId: M3, variantId: V3, cc: 200 };

// Exactly the spec's example: A serves services 1,2 — B serves 2,3 — C serves 4,5.
const ROWS = [
  { _id: "as1", base_service_id: "svc1", dealer_id: D1, companies: [HONDA], bikes: [{ model_id: M1, variant_id: V1, cc: 110, price: 500 }] },
  { _id: "as2", base_service_id: "svc2", dealer_id: D1, companies: [HONDA], bikes: [{ model_id: M1, variant_id: V1, cc: 110, price: 600 }, { model_id: M2, variant_id: V2, cc: 150, price: 700 }] },
  { _id: "as3", base_service_id: "svc3", dealer_id: D2, companies: [HONDA], bikes: [{ model_id: M2, variant_id: V2, cc: 150, price: 800 }] },
  { _id: "as4", base_service_id: "svc4", dealer_id: D2, companies: [HERO], bikes: [{ model_id: M3, variant_id: V3, cc: 200, price: 900 }] },
  { _id: "as5", base_service_id: "svc5", dealer_id: D3, companies: [HERO], bikes: [{ model_id: M3, variant_id: V3, cc: 200, price: 1000 }] },
  // Priced only for a bike nobody in this garage owns.
  { _id: "as6", base_service_id: "svc6", dealer_id: D1, companies: [HONDA], bikes: [{ model_id: M9, variant_id: V9, cc: 110, price: 400 }] },
];

function dealer(id, extra = {}) {
  return { _id: id, shopName: `Shop ${id}`, latitude: 1, longitude: 1, providesTowing: false, ...extra };
}

function scopeOf(entries, kind = "area") {
  return buildScope(kind, entries);
}

const ALL_DEALERS = scopeOf([
  { dealer: dealer(D1), distanceKm: 2 },
  { dealer: dealer(D2), distanceKm: 5 },
  { dealer: dealer(D3), distanceKm: 9 },
]);

const sorted = set => Array.from(set).sort();

// ── toBikeContext: a saved bike becomes an eligibility context ──────────────
const savedBike = {
  _id: "bikeA",
  name: "Splendor",
  plate_number: "MP09AB1234",
  bike_cc: "110",
  variant_id: { _id: V1, engine_cc: 110, model_id: { _id: M1, company_id: { _id: HONDA } } },
};
const ctx = toBikeContext(savedBike);
assert.strictEqual(String(ctx.companyId), HONDA);
assert.strictEqual(String(ctx.modelId), M1);
assert.strictEqual(String(ctx.variantId), V1);
assert.strictEqual(ctx.cc, 110);

// engine_cc on the variant wins over the denormalized string on the bike.
assert.strictEqual(
  toBikeContext({ ...savedBike, bike_cc: "999" }).cc,
  110,
);
// …but a variant with no cc falls back to the bike's own value rather than null.
assert.strictEqual(
  toBikeContext({ ...savedBike, variant_id: { ...savedBike.variant_id, engine_cc: null } }).cc,
  110,
);
// A broken brand/model/variant chain yields null — never a context that
// "matches everything".
assert.strictEqual(toBikeContext({ _id: "x", variant_id: null }), null);
assert.strictEqual(toBikeContext({ _id: "x", variant_id: { _id: V1, model_id: null } }), null);
assert.strictEqual(toBikeContext(null), null);

// ── normalizeIdList ─────────────────────────────────────────────────────────
assert.deepStrictEqual(normalizeIdList(`${V1},${V2}`), [V1, V2]);
assert.deepStrictEqual(normalizeIdList([V1, " not-an-id ", V2]), [V1, V2]);
assert.deepStrictEqual(normalizeIdList(""), []);
assert.deepStrictEqual(normalizeIdList(null), []);

// ── Dealer scope filters ────────────────────────────────────────────────────
assert.deepStrictEqual(dealerScopeBaseFilter(), {
  online: true,
  isBlocked: { $ne: true },
  wallet: { $gt: -500 },
});
// A bike that has to be towed may only ever see garages that tow.
assert.strictEqual(dealerScopeBaseFilter({ towingRequired: true }).providesTowing, true);

// Area/city scopes push a bounded dealer list into mongo; network scope does
// not (it would be every dealer on the platform) and filters in memory.
assert.deepStrictEqual(adminServiceScopeFilter(ALL_DEALERS), { dealer_id: { $in: [D1, D2, D3] } });
assert.deepStrictEqual(adminServiceScopeFilter(scopeOf([{ dealer: dealer(D1), distanceKm: null }], "network")), {});

// ── buildScope ──────────────────────────────────────────────────────────────
assert.strictEqual(ALL_DEALERS.isEmpty, false);
assert.strictEqual(ALL_DEALERS.distanceByDealerId.get(D1), 2);
assert.strictEqual(ALL_DEALERS.dealerById.get(D1).shopName, `Shop ${D1}`);
assert.strictEqual(scopeOf([]).isEmpty, true);

// ── Per-row bike compatibility ──────────────────────────────────────────────
assert.strictEqual(adminServiceSupportsBike(ROWS[0], BIKE_A), true);
assert.strictEqual(adminServiceSupportsBike(ROWS[0], BIKE_B), false);
// Brand not listed → no match even though a price row exists.
assert.strictEqual(adminServiceSupportsBike(ROWS[3], BIKE_A), false);
// No bike in play → nothing to be incompatible with.
assert.strictEqual(adminServiceSupportsBike(ROWS[0], null), true);
assert.deepStrictEqual(
  matchingBikeContexts(ROWS[1], [BIKE_A, BIKE_B, BIKE_C]).map(b => b.bikeId),
  ["bikeA", "bikeB"],
);
assert.deepStrictEqual(matchingBikeContexts(ROWS[5], [BIKE_A, BIKE_B, BIKE_C]), []);

// ── Indicative price ────────────────────────────────────────────────────────
// Cheapest across the saved bikes this row actually serves.
assert.strictEqual(resolveIndicativePrice(ROWS[1], [BIKE_A, BIKE_B]), 600);
assert.strictEqual(resolveIndicativePrice(ROWS[1], [BIKE_B]), 700);
// No bike context → the row's own cheapest entry, as an indicative floor.
assert.strictEqual(resolveIndicativePrice(ROWS[1], []), 600);
assert.strictEqual(resolveIndicativePrice({ bikes: [] }, []), null);

// ── 1. NO SAVED BIKE: no compatibility filter, provider availability still applies
{
  const { serviceIds, byServiceId } = buildServiceEligibilityIndex({ rows: ROWS, scope: ALL_DEALERS, bikeContexts: [] });
  assert.deepStrictEqual(serviceIds.sort(), ["svc1", "svc2", "svc3", "svc4", "svc5", "svc6"]);
  // No bike means no bike attribution, not "every bike".
  assert.deepStrictEqual(sorted(byServiceId.get("svc2").eligibleBikeIds), []);

  // A service whose only dealer is out of scope disappears even with no bike.
  const noD3 = scopeOf([{ dealer: dealer(D1), distanceKm: 2 }, { dealer: dealer(D2), distanceKm: 5 }]);
  const narrowed = buildServiceEligibilityIndex({ rows: ROWS, scope: noD3, bikeContexts: [] });
  assert.ok(!narrowed.serviceIds.includes("svc5"));
}

// ── 2. ONE SAVED BIKE: only what that bike can actually be booked for ───────
{
  const a = buildServiceEligibilityIndex({ rows: ROWS, scope: ALL_DEALERS, bikeContexts: [BIKE_A] });
  assert.deepStrictEqual(a.serviceIds.sort(), ["svc1", "svc2"]);

  const b = buildServiceEligibilityIndex({ rows: ROWS, scope: ALL_DEALERS, bikeContexts: [BIKE_B] });
  assert.deepStrictEqual(b.serviceIds.sort(), ["svc2", "svc3"]);

  const c = buildServiceEligibilityIndex({ rows: ROWS, scope: ALL_DEALERS, bikeContexts: [BIKE_C] });
  assert.deepStrictEqual(c.serviceIds.sort(), ["svc4", "svc5"]);

  // svc6 is priced for a bike nobody owns and must never surface.
  assert.ok(!a.serviceIds.includes("svc6"));
  assert.ok(!b.serviceIds.includes("svc6"));
  assert.ok(!c.serviceIds.includes("svc6"));
}

// ── 3. MULTIPLE SAVED BIKES: UNION, de-duplicated ──────────────────────────
{
  const { serviceIds, byServiceId } = buildServiceEligibilityIndex({
    rows: ROWS,
    scope: ALL_DEALERS,
    bikeContexts: [BIKE_A, BIKE_B, BIKE_C],
  });

  // A(1,2) ∪ B(2,3) ∪ C(4,5) = {1,2,3,4,5}; svc2 appears once, not twice.
  assert.deepStrictEqual(serviceIds.sort(), ["svc1", "svc2", "svc3", "svc4", "svc5"]);
  assert.strictEqual(serviceIds.filter(id => id === "svc2").length, 1);
  assert.ok(!serviceIds.includes("svc6"));

  // The union is never just the first/default bike's set.
  const firstBikeOnly = buildServiceEligibilityIndex({ rows: ROWS, scope: ALL_DEALERS, bikeContexts: [BIKE_A] });
  assert.notDeepStrictEqual(serviceIds.sort(), firstBikeOnly.serviceIds.sort());

  // Each service knows which saved bikes made it eligible.
  assert.deepStrictEqual(sorted(byServiceId.get("svc1").eligibleBikeIds), ["bikeA"]);
  assert.deepStrictEqual(sorted(byServiceId.get("svc2").eligibleBikeIds), ["bikeA", "bikeB"]);
  assert.deepStrictEqual(sorted(byServiceId.get("svc4").eligibleBikeIds), ["bikeC"]);

  // Cheapest price across the bikes that service can actually be booked for.
  assert.strictEqual(byServiceId.get("svc2").minPrice, 600);
  assert.strictEqual(byServiceId.get("svc3").minPrice, 800);

  // Nearest eligible dealer per service, straight out of the same pass.
  assert.strictEqual(byServiceId.get("svc2").minDistanceKm, 2);
  assert.strictEqual(byServiceId.get("svc4").minDistanceKm, 5);
  assert.strictEqual(byServiceId.get("svc2").dealerIds.size, 1);
}

// ── Eligibility is bike AND location: dropping a dealer drops its services ──
{
  const withoutD3 = scopeOf([{ dealer: dealer(D1), distanceKm: 2 }, { dealer: dealer(D2), distanceKm: 5 }]);
  const { serviceIds } = buildServiceEligibilityIndex({
    rows: ROWS,
    scope: withoutD3,
    bikeContexts: [BIKE_A, BIKE_B, BIKE_C],
  });
  // svc5 lived only at D3, which is now out of range.
  assert.deepStrictEqual(serviceIds.sort(), ["svc1", "svc2", "svc3", "svc4"]);
}

// ── 7. ZERO RESULT: honest empty, never a fallback ─────────────────────────
{
  // A rider whose bikes nobody nearby can service gets nothing at all.
  const ORPHAN = { bikeId: "orphan", companyId: "6512c0000000000000000009", modelId: M9, variantId: V9, cc: 350 };
  const { serviceIds } = buildServiceEligibilityIndex({ rows: ROWS, scope: ALL_DEALERS, bikeContexts: [ORPHAN] });
  assert.deepStrictEqual(serviceIds, []);

  // No dealers in range → nothing, whatever the catalog holds.
  const empty = buildServiceEligibilityIndex({ rows: ROWS, scope: scopeOf([]), bikeContexts: [BIKE_A] });
  assert.deepStrictEqual(empty.serviceIds, []);
}

// ── 4. PROVIDER SELECTION: one selected bike, no union, no fallback ─────────
const GARAGE_ROWS = [
  // D1 can do svc2 for bike A and bike B.
  { _id: "g1", base_service_id: "svc2", dealer_id: D1, companies: [HONDA], bikes: [{ model_id: M1, variant_id: V1, cc: 110, price: 600 }, { model_id: M2, variant_id: V2, cc: 150, price: 700 }] },
  // D2 lists the brand but has only priced bike A's variant.
  { _id: "g2", base_service_id: "svc2", dealer_id: D2, companies: [HONDA], bikes: [{ model_id: M1, variant_id: V1, cc: 110, price: 550 }] },
  // D3 serves bike C's brand but has only priced a model nobody here owns —
  // the cheap garage that must NOT be offered as a fallback.
  { _id: "g3", base_service_id: "svc2", dealer_id: D3, companies: [HERO], bikes: [{ model_id: M9, variant_id: V9, cc: 350, price: 300 }] },
];

{
  const forA = buildGarageEntries({ rows: GARAGE_ROWS, scope: ALL_DEALERS, bikeContext: BIKE_A });
  assert.deepStrictEqual(forA.map(e => String(e.dealer._id)).sort(), [D1, D2].sort());
  assert.deepStrictEqual(forA.map(e => e.price).sort((x, y) => x - y), [550, 600]);
  assert.strictEqual(forA.find(e => String(e.dealer._id) === D1).distanceKm, 2);

  // Selecting bike B leaves only the garage that priced bike B — D2's cheaper
  // ₹550 row is for a different variant and must not leak in.
  const forB = buildGarageEntries({ rows: GARAGE_ROWS, scope: ALL_DEALERS, bikeContext: BIKE_B });
  assert.deepStrictEqual(forB.map(e => String(e.dealer._id)), [D1]);
  assert.deepStrictEqual(forB.map(e => e.price), [700]);

  // A bike no garage has priced yields an empty list, never the ₹300 garage
  // that happens to be nearby.
  const forC = buildGarageEntries({ rows: GARAGE_ROWS, scope: ALL_DEALERS, bikeContext: BIKE_C });
  assert.deepStrictEqual(forC, []);

  // A garage outside the scope is unreachable regardless of compatibility.
  const onlyD2 = scopeOf([{ dealer: dealer(D2), distanceKm: 5 }]);
  assert.deepStrictEqual(
    buildGarageEntries({ rows: GARAGE_ROWS, scope: onlyD2, bikeContext: BIKE_A }).map(e => String(e.dealer._id)),
    [D2],
  );

  // Legacy variant_id/cc narrowing: unchanged behaviour for clients that know
  // the variant but not the brand/model.
  assert.deepStrictEqual(
    buildGarageEntries({ rows: GARAGE_ROWS, scope: ALL_DEALERS, variantId: V2 }).map(e => e.price),
    [700],
  );
  assert.deepStrictEqual(
    buildGarageEntries({ rows: GARAGE_ROWS, scope: ALL_DEALERS, variantId: V1, cc: 150 }),
    [],
  );
  // No bike at all → every in-scope garage, priced at its cheapest row.
  assert.deepStrictEqual(
    buildGarageEntries({ rows: GARAGE_ROWS, scope: ALL_DEALERS }).map(e => e.price).sort((x, y) => x - y),
    [300, 550, 600],
  );

  // Service radius travels with the garage, defaulting when unset.
  assert.strictEqual(forA[0].serviceRadiusKm, 3);
  const wide = scopeOf([{ dealer: dealer(D1, { serviceRadiusKm: 12 }), distanceKm: 2 }]);
  assert.strictEqual(buildGarageEntries({ rows: GARAGE_ROWS, scope: wide, bikeContext: BIKE_A })[0].serviceRadiusKm, 12);
}

console.log("serviceEligibility.test.js — all assertions passed");
