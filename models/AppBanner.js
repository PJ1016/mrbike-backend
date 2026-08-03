const mongoose = require("mongoose");

const BANNER_TYPES = ["home", "popup", "announcement"];

const appBannerSchema = new mongoose.Schema(
  {
    bannerType: { type: String, enum: BANNER_TYPES, required: true },
    image: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    linkUrl: { type: String, default: "" },
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
appBannerSchema.index({ legacyBannerId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("AppBanner", appBannerSchema);
module.exports.BANNER_TYPES = BANNER_TYPES;
