const mongoose = require("mongoose");

const BANNER_TYPES = ["home", "popup", "announcement"];

const appBannerSchema = new mongoose.Schema(
  {
    bannerType: { type: String, enum: BANNER_TYPES, required: true },
    image: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    linkUrl: { type: String, default: "" },
    displayOrder: { type: Number, default: 0 },
    scheduleStart: { type: Date, default: null },
    scheduleEnd: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

appBannerSchema.index({ bannerType: 1, isDeleted: 1, displayOrder: 1 });

module.exports = mongoose.model("AppBanner", appBannerSchema);
module.exports.BANNER_TYPES = BANNER_TYPES;
