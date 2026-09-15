// Unit tests for the Service Detail read path and its backfill. Pure — no DB,
// no HTTP; run with `npm test`.
const assert = require("assert");
const {
  resolveAdminServicePrice,
  computeFromPrice,
  countProviders,
  mergeServiceDetail,
} = require("../v1-api/helpers/serviceDetail");
const {
  buildUpdate,
  deriveShortDescription,
  deriveWarrantyText,
} = require("../scripts/backfillServiceDetail");

// ── Price resolution: must mirror garagesForService ─────────────────────────
const VARIANT = "6512ab000000000000000001";
const OTHER_VARIANT = "6512ab000000000000000002";

const svc = {
  dealer_id: "d1",
  bikes: [
    { variant_id: VARIANT, cc: 110, price: 499 },
    { variant_id: VARIANT, cc: 150, price: 699 },
    { variant_id: OTHER_VARIANT, cc: 110, price: 399 },
  ],
};

// No bike context → cheapest row, as an indicative floor.
assert.strictEqual(resolveAdminServicePrice(svc), 399);
// With a variant → that variant's row, not the globally cheapest one.
assert.strictEqual(resolveAdminServicePrice(svc, { variantId: VARIANT }), 499);
// cc narrows within the variant.
assert.strictEqual(resolveAdminServicePrice(svc, { variantId: VARIANT, cc: 150 }), 699);
// A variant this dealer hasn't priced yields null, keeping them out of the floor.
assert.strictEqual(resolveAdminServicePrice(svc, { variantId: "6512ab000000000000000009" }), null);
// Missing/empty bike rows never throw and never invent a price.
assert.strictEqual(resolveAdminServicePrice({ bikes: [] }), null);
assert.strictEqual(resolveAdminServicePrice({}), null);
assert.strictEqual(resolveAdminServicePrice(null), null);
// A row with a non-numeric price is ignored rather than rendered as ₹0.
assert.strictEqual(resolveAdminServicePrice({ bikes: [{ price: null }, { price: 250 }] }), 250);

// ── fromPrice: lowest across eligible providers ─────────────────────────────
assert.strictEqual(
  computeFromPrice([{ dealer_id: "d1", bikes: [{ price: 800 }] }, { dealer_id: "d2", bikes: [{ price: 650 }] }]),
  650
);
// Nobody priced → null. This must render as "no price", never as ₹0.
assert.strictEqual(computeFromPrice([{ dealer_id: "d1", bikes: [] }]), null);
assert.strictEqual(computeFromPrice([]), null);
assert.strictEqual(computeFromPrice(null), null);
// With a variant, dealers without a matching row drop out of the floor.
assert.strictEqual(
  computeFromPrice(
    [
      { dealer_id: "d1", bikes: [{ variant_id: OTHER_VARIANT, cc: 110, price: 100 }] },
      { dealer_id: "d2", bikes: [{ variant_id: VARIANT, cc: 110, price: 900 }] },
    ],
    { variantId: VARIANT }
  ),
  900
);

// ── providerCount: distinct dealers, not AdminService rows ──────────────────
assert.strictEqual(countProviders([{ dealer_id: "d1" }, { dealer_id: "d1" }, { dealer_id: "d2" }]), 2);
// Populated dealer documents count the same as raw ids.
assert.strictEqual(countProviders([{ dealer_id: { _id: "d1" } }, { dealer_id: "d1" }]), 1);
assert.strictEqual(countProviders([]), 0);
assert.strictEqual(countProviders(null), 0);
assert.strictEqual(countProviders([{ dealer_id: null }]), 0);

// ── Merge: a service with no detail row still renders ───────────────────────
const legacyService = {
  _id: "s1",
  name: "General Service",
  image: "base-services/general.png",
  description: "Full general service",
  basePrice: 349,
  duration: 45,
  pickupAvailable: true,
  warranty: true,
  categoryId: { _id: "c1", name: "Periodic", icon: "icons/periodic.png" },
};

const bare = mergeServiceDetail(legacyService, null, { formatUrl: u => (u ? `https://cdn/${u}` : u) });
assert.strictEqual(bare.hasDetail, false);
assert.strictEqual(bare.name, "General Service");
// The legacy single image becomes a one-image gallery so the new screen has
// something to show for every pre-existing service.
assert.strictEqual(bare.images.length, 1);
assert.strictEqual(bare.images[0].url, "https://cdn/base-services/general.png");
assert.strictEqual(bare.images[0].isCover, true);
assert.strictEqual(bare.coverImage, "https://cdn/base-services/general.png");
// Base fields keep their existing names/meanings for the list endpoints.
assert.strictEqual(bare.image, "https://cdn/base-services/general.png");
assert.strictEqual(bare.basePrice, 349);
assert.strictEqual(bare.duration, 45);
assert.strictEqual(bare.warranty, true);
assert.deepStrictEqual(bare.category, { id: "c1", name: "Periodic", icon: "https://cdn/icons/periodic.png" });
// Detail-only fields degrade to empty, never undefined.
assert.strictEqual(bare.fullDescription, "Full general service");
assert.strictEqual(bare.videoUrl, null);
assert.strictEqual(bare.durationMinutes, 45);
assert.deepStrictEqual(bare.essentialItems, []);
assert.deepStrictEqual(bare.benefits, []);
assert.deepStrictEqual(bare.faqs, []);

// A service with no image at all yields an empty gallery rather than [null].
assert.deepStrictEqual(mergeServiceDetail({ _id: "s2", name: "X" }, null).images, []);

// ── Merge: unpublished content must not leak to the public endpoint ─────────
const draft = {
  isPublished: false,
  fullDescription: "<p>Draft copy</p>",
  videoUrl: "https://www.youtube.com/embed/abc12345678",
  benefits: [{ title: "Draft benefit", order: 0 }],
};
const hidden = mergeServiceDetail(legacyService, draft);
assert.strictEqual(hidden.hasDetail, false);
assert.strictEqual(hidden.fullDescription, "Full general service");
assert.strictEqual(hidden.videoUrl, null);
assert.deepStrictEqual(hidden.benefits, []);
// …but the admin preview path can opt in.
const preview = mergeServiceDetail(legacyService, draft, { includeUnpublished: true });
assert.strictEqual(preview.hasDetail, true);
assert.strictEqual(preview.fullDescription, "<p>Draft copy</p>");

// ── Merge: published content, ordering, and overrides ───────────────────────
const detail = {
  isPublished: true,
  fullDescription: "<p>Rich copy</p>",
  videoUrl: "https://www.youtube.com/embed/abc12345678",
  durationMinutes: 90,
  warrantyText: "30 days / 1000 km",
  recommendedInterval: "Every 3000 km",
  images: [
    { url: "d/second.png", order: 2, alt: "Second" },
    { url: "d/cover.png", order: 1, alt: "Cover", isCover: true },
  ],
  essentialItems: [
    { title: "Brake check", order: 2 },
    { title: "Engine oil change", order: 1 },
  ],
  optionalItems: [{ title: "Chain lube", order: 1 }],
  benefits: [{ title: "Doorstep pickup", description: "Free", icon: "truck", order: 1 }],
  faqs: [
    { question: "How long?", answer: "About 90 minutes", order: 2 },
    { question: "Genuine parts?", answer: "Always", order: 1 },
  ],
};

const rich = mergeServiceDetail(legacyService, detail, { formatUrl: u => (u ? `https://cdn/${u}` : u) });
assert.strictEqual(rich.hasDetail, true);
assert.strictEqual(rich.fullDescription, "<p>Rich copy</p>");
assert.strictEqual(rich.videoUrl, "https://www.youtube.com/embed/abc12345678");
// Detail duration overrides the base estimate.
assert.strictEqual(rich.durationMinutes, 90);
assert.strictEqual(rich.warrantyText, "30 days / 1000 km");
assert.strictEqual(rich.recommendedInterval, "Every 3000 km");
// Gallery is ordered by `order`, and the flagged cover wins over first-by-order.
assert.deepStrictEqual(rich.images.map(i => i.url), ["https://cdn/d/cover.png", "https://cdn/d/second.png"]);
assert.strictEqual(rich.coverImage, "https://cdn/d/cover.png");
// Content blocks sort by `order`, not insertion order.
assert.deepStrictEqual(rich.essentialItems.map(i => i.title), ["Engine oil change", "Brake check"]);
assert.deepStrictEqual(rich.faqs.map(f => f.question), ["Genuine parts?", "How long?"]);
assert.deepStrictEqual(rich.benefits, [{ title: "Doorstep pickup", description: "Free", icon: "truck" }]);
// The legacy `image` field is still emitted untouched alongside the gallery.
assert.strictEqual(rich.image, "https://cdn/base-services/general.png");

// An empty detail field must not blank out copy the base service already has.
const sparse = mergeServiceDetail(
  { ...legacyService, warrantyText: "Base warranty", recommendedInterval: "Every 5000 km" },
  { isPublished: true, warrantyText: "", recommendedInterval: "", fullDescription: "", durationMinutes: null }
);
assert.strictEqual(sparse.warrantyText, "Base warranty");
assert.strictEqual(sparse.recommendedInterval, "Every 5000 km");
assert.strictEqual(sparse.fullDescription, "Full general service");
// durationMinutes null means "inherit", not "zero minutes".
assert.strictEqual(sparse.durationMinutes, 45);

// ── Backfill: derivation ────────────────────────────────────────────────────
assert.strictEqual(deriveShortDescription("Full general service"), "Full general service");
// The admin panel's AI button emits dash-bulleted lists; take the first bullet.
assert.strictEqual(deriveShortDescription("- Engine oil change\n- Brake check"), "Engine oil change");
assert.strictEqual(deriveShortDescription("\n\n  • Chain cleaning  \n- Wash"), "Chain cleaning");
assert.strictEqual(deriveShortDescription(""), "");
assert.strictEqual(deriveShortDescription("   \n  "), "");
assert.strictEqual(deriveShortDescription(undefined), "");
assert.strictEqual(deriveShortDescription(null), "");

const long = deriveShortDescription("word ".repeat(80));
assert.ok(long.length <= 161, `expected truncation, got ${long.length}`);
assert.ok(long.endsWith("…"));
// A single unbroken 200-char token still truncates rather than overflowing.
assert.ok(deriveShortDescription("x".repeat(200)).length <= 161);

assert.strictEqual(deriveWarrantyText(true), "Warranty included");
// warranty=false yields "" so the chip hides, rather than advertising absence.
assert.strictEqual(deriveWarrantyText(false), "");
assert.strictEqual(deriveWarrantyText(undefined), "");

// ── Backfill: non-destructive and idempotent ────────────────────────────────
const legacyDoc = { _id: "s1", name: "General Service", description: "- Oil change\n- Wash", warranty: true };
const firstRun = buildUpdate(legacyDoc);
assert.deepStrictEqual(firstRun, {
  shortDescription: "Oil change",
  warrantyText: "Warranty included",
  recommendedInterval: "",
  hasDetail: false,
});
// Nothing in the update touches image/description/name/duration/warranty.
["image", "description", "name", "duration", "warranty", "basePrice", "_id", "id"].forEach(field =>
  assert.ok(!(field in firstRun), `backfill must never write ${field}`)
);

// Re-running against the already-backfilled document is a no-op.
assert.strictEqual(buildUpdate({ ...legacyDoc, ...firstRun }), null);

// An admin-authored value is never overwritten by a later run.
const authored = buildUpdate({
  ...legacyDoc,
  shortDescription: "Hand-written summary",
  warrantyText: "90 days",
  recommendedInterval: "Every 3000 km",
  hasDetail: true,
});
assert.strictEqual(authored, null);

// A service whose description yields nothing gets no shortDescription key at
// all, rather than being written an empty string.
const noDesc = buildUpdate({ _id: "s3", name: "Bare", description: "", warranty: false });
assert.deepStrictEqual(noDesc, { recommendedInterval: "", hasDetail: false });

console.log("Service detail tests passed");
