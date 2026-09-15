// Unit tests for the Service Detail CMS write rules. Pure — no DB, no HTTP;
// run with `npm test`.
const assert = require("assert");
const {
  MAX_IMAGES,
  isRichTextEmpty,
  normalizeTextField,
  normalizeDurationMinutes,
  normalizeImages,
  normalizeContentItems,
  normalizeFaqs,
  collectPublishBlockers,
} = require("../v1-api/helpers/serviceDetailValidation");
const { sanitizeRichText } = require("../utils/sanitizeHtml");
const { toYoutubeEmbedUrl } = require("../utils/youtube");

// ── Rich-text emptiness: Quill's empty state is not "" ──────────────────────
assert.strictEqual(isRichTextEmpty(""), true);
assert.strictEqual(isRichTextEmpty(null), true);
assert.strictEqual(isRichTextEmpty(undefined), true);
assert.strictEqual(isRichTextEmpty("<p><br></p>"), true);
assert.strictEqual(isRichTextEmpty("<p>&nbsp;</p>"), true);
assert.strictEqual(isRichTextEmpty("<p>  </p>"), true);
assert.strictEqual(isRichTextEmpty("<p>Real copy</p>"), false);

// ── Text fields: undefined leaves alone, null clears ────────────────────────
assert.deepStrictEqual(normalizeTextField(undefined, "warrantyText"), { value: undefined });
assert.deepStrictEqual(normalizeTextField(null, "warrantyText"), { value: "" });
assert.deepStrictEqual(normalizeTextField("  30 days  ", "warrantyText"), { value: "30 days" });
assert.ok(normalizeTextField(123, "warrantyText").error);
assert.ok(normalizeTextField("x".repeat(201), "warrantyText").error);
assert.deepStrictEqual(normalizeTextField("x".repeat(250), "shortDescription", 300), { value: "x".repeat(250) });

// ── Duration override: null means "inherit", 0 means "zero" ─────────────────
assert.deepStrictEqual(normalizeDurationMinutes(undefined), { value: undefined });
assert.deepStrictEqual(normalizeDurationMinutes(null), { value: null });
assert.deepStrictEqual(normalizeDurationMinutes(""), { value: null });
assert.deepStrictEqual(normalizeDurationMinutes("90"), { value: 90 });
assert.deepStrictEqual(normalizeDurationMinutes(0), { value: 0 });
assert.deepStrictEqual(normalizeDurationMinutes(45.6), { value: 46 });
assert.ok(normalizeDurationMinutes(-1).error);
assert.ok(normalizeDurationMinutes(1441).error);
assert.ok(normalizeDurationMinutes("abc").error);

// ── Images: array position is the ordering truth ────────────────────────────
const imgs = normalizeImages([
  { url: "https://s3/b.png", order: 99, alt: "B" },
  { url: "https://s3/a.png", order: 0, alt: "A" },
]);
// Client-sent `order` is discarded and re-derived from index, so a stale or
// duplicated order can never scramble the gallery.
assert.deepStrictEqual(imgs.value.map(i => [i.url, i.order]), [
  ["https://s3/b.png", 0],
  ["https://s3/a.png", 1],
]);
// Exactly one cover, always — defaults to the first when none is flagged.
assert.deepStrictEqual(imgs.value.map(i => i.isCover), [true, false]);

const flagged = normalizeImages([
  { url: "https://s3/a.png" },
  { url: "https://s3/b.png", isCover: true },
  { url: "https://s3/c.png", isCover: true },
]);
// Two flagged covers collapse to the first flagged one, never two.
assert.deepStrictEqual(flagged.value.map(i => i.isCover), [false, true, false]);
assert.strictEqual(flagged.value.filter(i => i.isCover).length, 1);

assert.deepStrictEqual(normalizeImages(undefined), { value: undefined });
assert.deepStrictEqual(normalizeImages([]).value, []);
assert.ok(normalizeImages("nope").error);
assert.ok(normalizeImages([{ url: "" }]).error);
// Relative paths are rejected — stored gallery URLs must be absolute S3 URLs.
assert.ok(normalizeImages([{ url: "service-detail-media/x.png" }]).error);
assert.ok(normalizeImages([{ url: "javascript:alert(1)" }]).error);
// A duplicate URL would make delete-by-url ambiguous.
assert.ok(normalizeImages([{ url: "https://s3/a.png" }, { url: "https://s3/a.png" }]).error);
assert.ok(normalizeImages(new Array(MAX_IMAGES + 1).fill(0).map((_, i) => ({ url: `https://s3/${i}.png` }))).error);

// ── Content items ───────────────────────────────────────────────────────────
const items = normalizeContentItems(
  [{ title: " Oil change ", description: " Full synthetic ", icon: "oil" }, { title: "Brake check" }],
  "essentialItems"
);
assert.deepStrictEqual(items.value, [
  { title: "Oil change", description: "Full synthetic", icon: "oil", order: 0 },
  { title: "Brake check", description: "", icon: "", order: 1 },
]);
assert.deepStrictEqual(normalizeContentItems(undefined, "benefits"), { value: undefined });
// An untitled item would render as an empty bullet — rejected, not dropped.
assert.ok(normalizeContentItems([{ title: "   " }], "benefits").error);
assert.ok(normalizeContentItems([{ title: "x".repeat(121) }], "benefits").error);
assert.ok(normalizeContentItems("nope", "benefits").error);

// ── FAQs ────────────────────────────────────────────────────────────────────
const faqs = normalizeFaqs([
  { question: " How long? ", answer: "<p>90 minutes</p>" },
  { question: "Parts?", answer: "<p>Genuine</p>" },
]);
assert.deepStrictEqual(faqs.value.map(f => [f.question, f.order]), [["How long?", 0], ["Parts?", 1]]);
assert.ok(normalizeFaqs([{ question: "", answer: "<p>x</p>" }]).error);
// Quill's empty state must not pass as an answer.
assert.ok(normalizeFaqs([{ question: "Q", answer: "<p><br></p>" }]).error);
assert.ok(normalizeFaqs([{ question: "Q" }]).error);

// ── Sanitization must survive the content pipeline ──────────────────────────
assert.strictEqual(sanitizeRichText('<p onclick="steal()">Safe</p>'), "<p>Safe</p>");
assert.strictEqual(sanitizeRichText("<script>bad()</script><p>Copy</p>"), "<p>Copy</p>");
assert.ok(!sanitizeRichText('<a href="javascript:alert(1)">x</a>').includes("javascript:"));
// Legitimate rich formatting is preserved, not flattened.
assert.ok(sanitizeRichText("<h2>Title</h2><ul><li>One</li></ul>").includes("<li>One</li>"));
// An answer that is ONLY a script sanitizes to empty — the controller rejects
// this rather than storing a blank FAQ.
assert.strictEqual(isRichTextEmpty(sanitizeRichText("<script>x</script>")), true);

// ── YouTube normalization is shared with the FAQ system ─────────────────────
const EMBED = "https://www.youtube.com/embed/dQw4w9WgXcQ";
assert.strictEqual(toYoutubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), EMBED);
assert.strictEqual(toYoutubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ"), EMBED);
assert.strictEqual(toYoutubeEmbedUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ"), EMBED);
assert.strictEqual(toYoutubeEmbedUrl(EMBED), EMBED);
assert.strictEqual(toYoutubeEmbedUrl("https://vimeo.com/123"), null);

// ── Publish gate: refuses incomplete content, lists every reason at once ────
const completeDetail = {
  images: [{ url: "https://s3/a.png", order: 0, isCover: true }],
  fullDescription: "<p>Everything this service covers.</p>",
  faqs: [{ question: "Q", answer: "<p>A</p>", order: 0 }],
  essentialItems: [{ title: "Oil change", order: 0 }],
  optionalItems: [],
  benefits: [{ title: "Doorstep pickup", order: 0 }],
};
const completeBase = { shortDescription: "Quick tune-up" };
assert.deepStrictEqual(collectPublishBlockers({ detail: completeDetail, baseService: completeBase }), []);

// No content at all → blocked on every required element.
const emptyBlockers = collectPublishBlockers({ detail: null, baseService: {} });
assert.ok(emptyBlockers.length >= 3);
assert.ok(emptyBlockers.some(b => /image/i.test(b)));
assert.ok(emptyBlockers.some(b => /Full description/i.test(b)));
assert.ok(emptyBlockers.some(b => /Short description/i.test(b)));

// Each individual gap is reported on its own.
assert.deepStrictEqual(
  collectPublishBlockers({ detail: { ...completeDetail, images: [] }, baseService: completeBase }),
  ["At least one service image is required"]
);
assert.deepStrictEqual(
  collectPublishBlockers({ detail: { ...completeDetail, fullDescription: "<p><br></p>" }, baseService: completeBase }),
  ["Full description is required"]
);
assert.deepStrictEqual(
  collectPublishBlockers({ detail: completeDetail, baseService: { shortDescription: "  " } }),
  ["Short description is required"]
);
assert.deepStrictEqual(
  collectPublishBlockers({
    detail: { ...completeDetail, faqs: [{ question: "Q", answer: "<p><br></p>" }] },
    baseService: completeBase,
  }),
  ["FAQ 1 is missing a question or answer"]
);
assert.deepStrictEqual(
  collectPublishBlockers({
    detail: { ...completeDetail, benefits: [{ title: "" }] },
    baseService: completeBase,
  }),
  ["Benefit 1 is missing a title"]
);
// Gallery with images but no cover is caught too.
assert.deepStrictEqual(
  collectPublishBlockers({
    detail: { ...completeDetail, images: [{ url: "https://s3/a.png", order: 0, isCover: false }] },
    baseService: completeBase,
  }),
  ["A cover image must be selected"]
);

console.log("Service detail validation tests passed");
