const mongoose = require("mongoose");

// Tracks each redemption of a PromoCode by a customer so per-user limits
// and aggregate usedCount can be enforced/audited independently of the
// PromoCode document itself.
//
// Written exactly once per booking, only when a dealer confirms the
// booking (controller/booking.js#updateBookingStatus) — never at promo
// apply/quote time, never at booking creation, never at payment or invoice
// generation. See services/pricingEngine.js / promoService.js for where the
// discount is computed and validated (before consumption is ever recorded).
const promoCodeUsageSchema = new mongoose.Schema(
  {
    promoCode: { type: mongoose.Schema.Types.ObjectId, ref: "PromoCode", required: true },
    code: { type: String, default: null }, // promo code string, denormalized for reporting
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "customer", required: true },
    booking_id: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    discountApplied: { type: Number, default: 0 },
    confirmedAt: { type: Date, default: null }, // when the dealer confirmed the booking
  },
  { timestamps: true }
);

promoCodeUsageSchema.index({ promoCode: 1, user_id: 1 });

module.exports = mongoose.model("PromoCodeUsage", promoCodeUsageSchema);
