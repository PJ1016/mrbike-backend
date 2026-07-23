const mongoose = require("mongoose");

// Singleton document (a single row is upserted/read by the controller),
// mirroring the AppSettings pattern. Phase 1 only stores the admin-facing
// toggles/amounts — referral codes, rewards, transactions, wallet and
// notifications are handled in later phases.
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReferralSettings", referralSettingsSchema);
