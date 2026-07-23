/**
 * Referral Settings Controller (Preferences module) — Phase 1
 *
 * Singleton document holding the admin-configurable referral toggles and
 * amounts. Referral codes, rewards, transactions, wallet and notifications
 * are out of scope for this phase.
 *
 * Endpoints (mounted at /bikedoctor/preferences/referral-settings):
 *   GET /   → getReferralSettings  (auto-created on first access)
 *   PUT /   → updateReferralSettings (JSON, upsert)
 */

const ReferralSettings = require("../../models/ReferralSettings");

const BOOLEAN_FIELDS = [
  "enableReferralSystem",
  "showRewardsReferralsMenu",
  "allowReferralCodeDuringRegistration",
  "enableReferrerReward",
  "enableNewUserReward",
  "firstBookingOnly",
];

const NUMBER_FIELDS = ["referrerRewardAmount", "newUserRewardAmount", "minimumBookingAmount"];

async function getSingleton() {
  let settings = await ReferralSettings.findOne({});
  if (!settings) settings = await ReferralSettings.create({});
  return settings;
}

function validateReferralSettingsInput(body) {
  for (const field of NUMBER_FIELDS) {
    if (body[field] !== undefined) {
      const value = Number(body[field]);
      if (Number.isNaN(value) || value < 0) return `${field} must be a non-negative number`;
    }
  }
  return null;
}

const getReferralSettings = async (req, res) => {
  try {
    const settings = await getSingleton();
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error("getReferralSettings error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const updateReferralSettings = async (req, res) => {
  try {
    const error = validateReferralSettingsInput(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const settings = await getSingleton();
    for (const field of BOOLEAN_FIELDS) {
      if (req.body[field] !== undefined) settings[field] = Boolean(req.body[field]);
    }
    for (const field of NUMBER_FIELDS) {
      if (req.body[field] !== undefined) settings[field] = Number(req.body[field]);
    }
    await settings.save();
    return res.status(200).json({ success: true, message: "Referral settings updated successfully", data: settings });
  } catch (error) {
    console.error("updateReferralSettings error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { getReferralSettings, updateReferralSettings };
