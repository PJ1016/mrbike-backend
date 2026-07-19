const mongoose = require("mongoose");

// Tracks each redemption of a PromoCode by a customer so per-user limits
// and aggregate usedCount can be enforced/audited independently of the
// PromoCode document itself.
const promoCodeUsageSchema = new mongoose.Schema(
  {
    promoCode: { type: mongoose.Schema.Types.ObjectId, ref: "PromoCode", required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "customer", required: true },
    booking_id: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    discountApplied: { type: Number, default: 0 },
  },
  { timestamps: true }
);

promoCodeUsageSchema.index({ promoCode: 1, user_id: 1 });

module.exports = mongoose.model("PromoCodeUsage", promoCodeUsageSchema);
