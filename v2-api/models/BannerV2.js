const mongoose = require("mongoose");

const bannerV2Schema = new mongoose.Schema(
  {
    bannerId: {
      type: String,
      unique: true,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      enum: ["navigate", "link", "none"],
      default: "navigate",
    },
    target: {
      type: String,
    },
    title: {
      type: String,
      required: true,
    },
    subtitle: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BannerV2", bannerV2Schema);
