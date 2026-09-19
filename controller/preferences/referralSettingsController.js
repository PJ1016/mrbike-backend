/**
 * Referral Settings Controller (Preferences module) — Phase 1
 *
 * Singleton document holding the admin-configurable referral toggles and
 * amounts, plus the per-service MR Bike Money redemption limits below.
 *
 * Endpoints (mounted at /bikedoctor/preferences/referral-settings):
 *   GET /   → getReferralSettings  (auto-created on first access)
 *   PUT /   → updateReferralSettings (JSON, upsert)
 */

const ReferralSettings = require("../../models/ReferralSettings");
const BaseService = require("../../models/baseService");
const mongoose = require("mongoose");

const BOOLEAN_FIELDS = [
  "enableReferralSystem",
  "showRewardsReferralsMenu",
  "allowReferralCodeDuringRegistration",
  "enableReferrerReward",
  "enableNewUserReward",
  "firstBookingOnly",
  "rewardOnReferralSignup",
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

const getMrBikeMoneyServiceLimits = async (req, res) => {
  try {
    const services = await BaseService.find({})
      .select("name image isActive mrBikeMoneyMaxRedeem")
      .sort({ name: 1 })
      .lean();
    return res.status(200).json({ success: true, data: services });
  } catch (error) {
    console.error("getMrBikeMoneyServiceLimits error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const updateMrBikeMoneyServiceLimit = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const amount = Number(req.body.mrBikeMoneyMaxRedeem);
    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ success: false, message: "Valid serviceId is required" });
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ success: false, message: "MR Bike Money limit must be a non-negative number" });
    }

    const service = await BaseService.findByIdAndUpdate(
      serviceId,
      { $set: { mrBikeMoneyMaxRedeem: Math.round(amount * 100) / 100 } },
      { new: true, runValidators: true }
    ).select("name image isActive mrBikeMoneyMaxRedeem");
    if (!service) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }
    return res.status(200).json({ success: true, message: "MR Bike Money limit updated", data: service });
  } catch (error) {
    console.error("updateMrBikeMoneyServiceLimit error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getReferralSettings,
  updateReferralSettings,
  getMrBikeMoneyServiceLimits,
  updateMrBikeMoneyServiceLimit,
};
