const mongoose = require("mongoose");

// Singleton document (a single row is upserted/read by the controller).
const appSettingsSchema = new mongoose.Schema(
  {
    supportEmail: { type: String, default: "" },
    supportPhone: { type: String, default: "" },
    whatsappNumber: { type: String, default: "" },
    supportHours: { type: String, default: "" },
    facebookUrl: { type: String, default: "" },
    instagramUrl: { type: String, default: "" },
    twitterUrl: { type: String, default: "" },
    youtubeUrl: { type: String, default: "" },
    linkedinUrl: { type: String, default: "" },
    websiteUrl: { type: String, default: "" },
    playStoreUrl: { type: String, default: "" },
    appStoreUrl: { type: String, default: "" },

    // ── Platform / convenience fee ────────────────────────────────────────
    // A flat fee MR Bike charges the customer on top of the garage's own
    // amount. Admin-controlled and global — a dealer can never set or see it
    // as part of their earnings, and it is deliberately NOT part of the
    // subtotal, so it is never taxed and never enters the commission or
    // dealer-payout base (see services/pricingEngine.js).
    //
    // Read through services/appSettingsService.js#getPlatformFeeConfig() and
    // snapshotted onto the Booking at creation, so changing the amount here
    // never re-prices a booking that already exists.
    platformFeeEnabled: { type: Boolean, default: false },
    platformFeeAmount: { type: Number, default: 0, min: 0 },
    // Shown as the line-item label in the customer app. Blank falls back to
    // "Platform Fee" at read time.
    platformFeeLabel: { type: String, default: "Platform Fee" },

    // ── GST on MR Bike's commission ───────────────────────────────────────
    // The commission MR Bike charges a garage is itself a taxable supply, so
    // GST applies on top of it: a ₹100 commission at 18% is recovered from
    // the dealer as ₹118. Admin-controlled because the statutory rate is not
    // ours to hardcode.
    //
    // This tax is entirely separate from `Dealer.tax`, which is the tax the
    // CUSTOMER pays on the garage's service. This one is charged BY MR Bike
    // TO the dealer, and the customer never sees or pays it — it comes out of
    // the dealer's payout (see services/pricingEngine.js).
    commissionTaxRate: { type: Number, default: 18, min: 0, max: 100 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AppSettings", appSettingsSchema);
