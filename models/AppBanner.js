const mongoose = require("mongoose");

const BANNER_TYPES = ["home", "popup", "announcement"];

const appBannerSchema = new mongoose.Schema(
  {
    bannerType: { type: String, enum: BANNER_TYPES, required: true },
    image: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    linkUrl: { type: String, default: "" },
    // True when the uploaded artwork is already a finished creative (offer
    // text, logo, price baked in). The apps then render the image alone —
    // no gradient, no title/description/button painted over or under it —
    // so a ready-made poster is not covered by the app's own chrome.
    imageOnly: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
    scheduleStart: { type: Date, default: null },
    scheduleEnd: { type: Date, default: null },
    // Optional geofence. Existing documents default to `all`, preserving the
    // behaviour of banners created before location targeting was introduced.
    locationType: { type: String, enum: ["all", "specific"], default: "all" },
    placeName: { type: String, default: "", trim: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    radiusKm: { type: Number, default: 10, min: 0.1 },
    legacyBannerId: { type: mongoose.Schema.Types.ObjectId, default: null },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

appBannerSchema.index({ bannerType: 1, isDeleted: 1, displayOrder: 1 });
// One AppBanner per synced legacy banner. This MUST be a partial index, not a
// sparse one: sparse only skips documents that are missing the field, and
// `legacyBannerId` has `default: null`, so Mongoose writes an explicit null on
// every banner created from the admin App Content drawer. Under the old sparse
// index the first such banner took the null slot and every later one failed
// with E11000, surfacing as a 500 from createAppBanner. Keying the constraint
// off "is actually an ObjectId" leaves all non-synced banners out of the index.
appBannerSchema.index(
  { legacyBannerId: 1 },
  { unique: true, partialFilterExpression: { legacyBannerId: { $type: "objectId" } } }
);

module.exports = mongoose.model("AppBanner", appBannerSchema);
module.exports.BANNER_TYPES = BANNER_TYPES;
