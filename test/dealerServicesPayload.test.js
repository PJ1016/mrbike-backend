// Unit tests for the two defects that made POST /bikedoctor/dealer/admin/services
// answer a blind 500. Pure — no DB, no HTTP; run with `npm test`.
//
//   1. saveDealerServices fed every field of every pricing row straight into
//      Mongoose. A row the admin panel round-tripped with a null serviceId (its
//      master base service was deleted) or a NaN price (empty price box) threw a
//      CastError inside findOne/create, which the catch-all flattened into
//      "Internal Server Error" with no way to tell which row was at fault.
//
//   2. The MKBDSVC-### / MKBDASVC-### generators picked the highest existing id
//      with a LEXICOGRAPHIC sort, so past 999 rows "-999" still outranked
//      "-1000" and every insert regenerated "-1000" into a unique index.
const assert = require("assert");
const { validatePricingRows } = require("../controller/service");
const { nextShortId } = require("../helper/shortServiceId");

const SVC = "6954b9bc4b8fa716ce636096";
const VAR = "6954b9bc4b8fa716ce636097";

const row = (over = {}) => ({ type: "base", serviceId: SVC, variantId: VAR, cc: 150, price: 499, ...over });

// ── Rows that must survive ──────────────────────────────────────────────────
{
  const { rows, errors } = validatePricingRows([row(), row({ type: "additional", price: 0 })]);
  assert.deepStrictEqual(errors, [], "well-formed rows produce no errors");
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].cc, 150, "cc is coerced to a number");
  assert.strictEqual(rows[1].price, 0, "a free service is a legitimate price");
}

// Strings are what HTTP actually delivers; they must coerce, not fail.
{
  const { rows, errors } = validatePricingRows([row({ cc: "150", price: "499" })]);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(rows[0].cc, 150);
  assert.strictEqual(rows[0].price, 499);
}

// variant_id is optional in both schemas — "Generic Bike" rows are real data.
for (const blank of [null, undefined, ""]) {
  const { rows, errors } = validatePricingRows([row({ variantId: blank })]);
  assert.deepStrictEqual(errors, [], `variantId ${JSON.stringify(blank)} is a generic-bike row, not an error`);
  assert.strictEqual(rows[0].variantId, null);
}

// An older panel build sending an unrecognised type is dropped, not fatal.
{
  const { rows, errors } = validatePricingRows([row({ type: "towing" }), row()]);
  assert.deepStrictEqual(errors, [], "unknown types are ignored");
  assert.strictEqual(rows.length, 1);
}

// ── Rows that must be rejected as 400s, not become 500s ─────────────────────
const rejected = [
  ["null serviceId (master base service was deleted)", row({ serviceId: null })],
  ["stringified undefined serviceId", row({ serviceId: "undefined" })],
  ["12-char serviceId that ObjectId.isValid() wrongly accepts", row({ serviceId: "undefined123" })],
  ["non-ObjectId variantId", row({ variantId: "not-an-id" })],
  ["NaN price from an empty price box", row({ price: Number("abc") })],
  ["negative price", row({ price: -1 })],
  ["NaN cc", row({ cc: Number("abc") })],
  ["negative cc", row({ cc: -50 })],
  ["a non-object row", "garbage"],
];

for (const [label, bad] of rejected) {
  const { rows, errors } = validatePricingRows([bad]);
  assert.strictEqual(errors.length, 1, `${label}: must be reported`);
  assert.strictEqual(rows.length, 0, `${label}: must not reach Mongoose`);
}

// The message has to name the row, or the admin cannot find it in a 200-row save.
{
  const { errors } = validatePricingRows([row(), row({ price: Number("abc") })]);
  assert.ok(errors[0].startsWith("pricing[1]"), "the error points at the offending index");
  assert.ok(/price/.test(errors[0]), "the error names the offending field");
}

// One bad row must not silently drop the good ones from the save.
{
  const { rows, errors } = validatePricingRows([row(), row({ serviceId: null }), row({ cc: 200 })]);
  assert.strictEqual(errors.length, 1);
  assert.strictEqual(rows.length, 2, "valid rows are still parsed so the caller can report both");
}

// ── nextShortId: numeric max, not lexicographic ─────────────────────────────
// Fake model whose aggregate() applies the real $split/$toLong/$sort pipeline
// semantics to an in-memory list of serviceIds.
const fakeModel = (serviceIds) => ({
  aggregate(pipeline) {
    const regex = pipeline[0].$match.serviceId.$regex;
    const limit = pipeline[3].$limit;
    const ranked = serviceIds
      .filter((s) => regex.test(s))
      .map((s) => ({ n: Number(s.split("-")[1]) }))
      .sort((a, b) => b.n - a.n)
      .slice(0, limit);
    return { exec: async () => ranked };
  },
});

(async () => {
  assert.strictEqual(await nextShortId(fakeModel([]), "MKBDSVC"), "MKBDSVC-001", "an empty collection starts at 001");
  assert.strictEqual(await nextShortId(fakeModel(["MKBDSVC-001", "MKBDSVC-002"]), "MKBDSVC"), "MKBDSVC-003");

  // The regression: with a lexicographic sort this returned MKBDSVC-1000 for
  // every insert after the 999th and collided on the unique index.
  const past999 = Array.from({ length: 1001 }, (_, i) => `MKBDSVC-${String(i + 1).padStart(3, "0")}`);
  assert.strictEqual(await nextShortId(fakeModel(past999), "MKBDSVC"), "MKBDSVC-1002", "numbering keeps climbing past 999");

  // Ids of a different prefix living in the same collection must not count.
  assert.strictEqual(
    await nextShortId(fakeModel(["MKBDASVC-500", "MKBDSVC-004"]), "MKBDSVC"),
    "MKBDSVC-005",
    "the prefix is anchored"
  );

  console.log("dealerServicesPayload.test.js: all assertions passed");
  // Requiring the controller pulls in the models, which leave mongoose handles
  // open even without a connection — exit explicitly so `npm test` moves on.
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
