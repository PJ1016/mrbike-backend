/**
 * App Content — App Settings Controller (Preferences module)
 *
 * Singleton document holding support contact info, social links, and
 * store/website URLs.
 *
 * Endpoints (mounted at /bikedoctor/preferences/app-settings):
 *   GET /   → getAppSettings  (auto-created on first access)
 *   PUT /   → updateAppSettings (JSON, upsert)
 */

const AppSettings = require("../../models/AppSettings");

const SETTINGS_FIELDS = [
  "supportEmail",
  "supportPhone",
  "whatsappNumber",
  "supportHours",
  "facebookUrl",
  "instagramUrl",
  "twitterUrl",
  "youtubeUrl",
  "linkedinUrl",
  "websiteUrl",
  "playStoreUrl",
  "appStoreUrl",
];

async function getSingleton() {
  let settings = await AppSettings.findOne({});
  if (!settings) settings = await AppSettings.create({});
  return settings;
}

const getAppSettings = async (req, res) => {
  try {
    const settings = await getSingleton();
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error("getAppSettings error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const updateAppSettings = async (req, res) => {
  try {
    const settings = await getSingleton();
    for (const field of SETTINGS_FIELDS) {
      if (req.body[field] !== undefined) settings[field] = req.body[field];
    }
    await settings.save();
    return res.status(200).json({ success: true, message: "App settings updated successfully", data: settings });
  } catch (error) {
    console.error("updateAppSettings error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { getAppSettings, updateAppSettings };
