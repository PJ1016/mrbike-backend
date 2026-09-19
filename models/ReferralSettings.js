const mongoose = require("mongoose");

// Singleton document (a single row is upserted/read by the controller),
// mirroring the AppSettings pattern. Phase 1 only stores the admin-facing
// toggles/amounts. Referral rewards are credited into MR Bike Money by
// services/referralRewardService.js.
const referralSettingsSchema = new mongoose.Schema(
  {
    enableReferralSystem: { type: Boolean, default: false },
    showRewardsReferralsMenu: { type: Boolean, default: false },
    allowReferralCodeDuringRegistration: { type: Boolean, default: false },
    enableReferrerReward: { type: Boolean, default: false },
    enableNewUserReward: { type: Boolean, default: false },
    referrerRewardAmount: { type: Number, default: 0, min: 0 },
    newUserRewardAmount: { type: Number, default: 0, min: 0 },
    minimumBookingAmount: { type: Number, default: 0, min: 0 },
    firstBookingOnly: { type: Boolean, default: false },
    rewardOnReferralSignup: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReferralSettings", referralSettingsSchema);
