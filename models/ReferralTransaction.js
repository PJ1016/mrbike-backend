const mongoose = require("mongoose");

const REWARD_TYPES = ["referrer", "new_user"];

const referralTransactionSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    referrerUserId: { type: mongoose.Schema.Types.ObjectId, ref: "customers", required: true },
    referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: "customers", required: true },
    rewardType: { type: String, enum: REWARD_TYPES, required: true },
    rewardAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["credited", "reversed"], default: "credited" },
  },
  { timestamps: true }
);

// One reward of each type per booking, ever. This is the idempotency
// guard: a second/duplicate booking-completion call for the same booking
// fails this unique index (E11000) instead of double-crediting.
referralTransactionSchema.index({ bookingId: 1, rewardType: 1 }, { unique: true });

module.exports = mongoose.model("ReferralTransaction", referralTransactionSchema);
module.exports.REWARD_TYPES = REWARD_TYPES;
