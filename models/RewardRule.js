const mongoose = require("mongoose");

const RULE_TYPES = [
  "referral-bonus",
  "point-rules",
  "redemption-rules",
  "signup-bonus",
  "cashback-rules",
];

// Single flexible collection backing all 5 Rewards & Referral rule types.
// Each ruleType only populates the fields relevant to it; the rest stay
// undefined. This mirrors the frontend, which posts one generic {...form}
// payload per ruleType rather than having 5 separate REST resources.
const rewardRuleSchema = new mongoose.Schema(
  {
    ruleType: { type: String, enum: RULE_TYPES, required: true },
    ruleName: { type: String, required: true, trim: true },

    // referral-bonus
    referrerBonusPoints: { type: Number },
    refereeBonusPoints: { type: Number },
    minBookingValue: { type: Number },
    maxReferralsPerUser: { type: Number },

    // point-rules
    earningBasis: { type: String, enum: ["per_100_spent", "fixed_per_booking"] },
    pointsValue: { type: Number },
    applicableService: { type: String },

    // redemption-rules
    minPointsToRedeem: { type: Number },
    pointValueInRupees: { type: Number },
    maxRedemptionPerOrder: { type: Number },

    // signup-bonus
    bonusPoints: { type: Number },
    bonusValidityDays: { type: Number },

    // cashback-rules
    minOrderValue: { type: Number },
    cashbackPercentage: { type: Number },
    maxCashback: { type: Number },

    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

rewardRuleSchema.index({ ruleType: 1, isDeleted: 1 });

module.exports = mongoose.model("RewardRule", rewardRuleSchema);
module.exports.RULE_TYPES = RULE_TYPES;
