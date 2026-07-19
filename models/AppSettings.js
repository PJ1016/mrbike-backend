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
  },
  { timestamps: true }
);

module.exports = mongoose.model("AppSettings", appSettingsSchema);
