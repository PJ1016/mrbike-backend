const mongoose = require("mongoose")

/**
 * Rich, presentation-only content for a BaseService.
 *
 * Deliberately a SEPARATE 1:1 collection rather than extra fields on
 * BaseService: every list/home/chatbot/booking query reads BaseService, and
 * several of them populate it without a projection. Keeping images, HTML
 * descriptions, benefit lists and FAQs out of that document means those
 * existing responses stay exactly the same size and shape as before, and the
 * detail screen pays for the extra content with one findOne it alone makes.
 *
 * Nothing here is ever used for pricing, provider eligibility or booking —
 * AdminService.bikes[].price and services/pricingEngine.js remain the only
 * sources of money, and isDealerBookable/serviceRadiusKm remain the only
 * source of who can be booked.
 */

// One image in the service gallery. `order` drives display sequence; exactly
// one row is expected to carry isCover, which is mirrored onto
// BaseService.image so every legacy consumer keeps working untouched.
const serviceImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    alt: { type: String, default: "", trim: true },
    order: { type: Number, default: 0 },
    isCover: { type: Boolean, default: false },
  },
  { _id: false },
)

// Shared shape for the three bullet-list blocks (essential items, optional
// items, benefits). `icon` is a client-side icon name, not a URL.
const contentItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    icon: { type: String, default: "", trim: true },
    order: { type: Number, default: 0 },
  },
  { _id: false },
)

const serviceFaqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true },
    order: { type: Number, default: 0 },
  },
  { _id: false },
)

const serviceDetailSchema = new mongoose.Schema(
  {
    baseServiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BaseService",
      required: true,
      unique: true,
      index: true,
    },

    // ── Media ───────────────────────────────────────────────────────────────
    images: { type: [serviceImageSchema], default: [] },
    // Canonical https://www.youtube.com/embed/<id> form, or null — the same
    // shape Faq.videoUrl already uses, normalized through utils/youtube.js so
    // every consumer deals with one form. No self-hosted video in this phase:
    // utils/s3Upload.js rejects video types and the user app has no native
    // player, only react-native-youtube-iframe.
    videoUrl: { type: String, default: null, trim: true },

    // ── Copy ────────────────────────────────────────────────────────────────
    // Long-form body. Sanitized on write by the admin endpoint that lands in
    // the next phase; nothing writes to it yet.
    fullDescription: { type: String, default: "" },

    // ── Spec chips ──────────────────────────────────────────────────────────
    // null means "inherit BaseService.duration" rather than "zero minutes",
    // which is why this is nullable where BaseService.duration defaults to 0.
    durationMinutes: { type: Number, default: null },
    warrantyText: { type: String, default: "", trim: true },
    recommendedInterval: { type: String, default: "", trim: true },

    // ── Content blocks ──────────────────────────────────────────────────────
    // essentialItems/optionalItems are INFORMATIONAL COPY describing what the
    // service does and does not cover. They are intentionally NOT named
    // "additionalServices": that name already belongs to the bookable,
    // dealer-priced `additionalServices` collection referenced by
    // Booking.additionalServices, and reusing it here would conflate content
    // with chargeable line items.
    essentialItems: { type: [contentItemSchema], default: [] },
    optionalItems: { type: [contentItemSchema], default: [] },
    benefits: { type: [contentItemSchema], default: [] },
    faqs: { type: [serviceFaqSchema], default: [] },

    // Detail content stays hidden until an admin explicitly publishes it, so
    // services backfilled with empty content never ship a half-built page.
    isPublished: { type: Boolean, default: false },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

serviceDetailSchema.index({ isPublished: 1 })

module.exports = mongoose.model("ServiceDetail", serviceDetailSchema)
