/**
 * Promo Code validation — the single place both the live quote preview
 * (controller/pricingController.js) and booking creation
 * (controller/booking.js#createBooking) resolve a promo code string into an
 * eligible PromoCode document + discount amount. Both callers MUST go
 * through this so a code that's valid at "Apply" time is checked by the
 * exact same rules at "Confirm Booking" time.
 *
 * Splits from services/pricingEngine.js#computePromoDiscountAmount because
 * usage-limit / per-user-limit checks require a DB round-trip
 * (PromoCodeUsage), which the pricing engine intentionally never does.
 */

const PromoCode = require("../models/PromoCode");
const PromoCodeUsage = require("../models/PromoCodeUsage");
const { computePromoDiscountAmount, PricingError } = require("./pricingEngine");

/**
 * @param {Object} params
 * @param {string} params.code - promo code as typed by the user
 * @param {string|ObjectId} [params.userId] - customer id, for the per-user limit check
 * @param {number} params.subtotal - booking subtotal (service + pickup/drop, pre-tax)
 * @returns {Promise<{ promo: import("mongoose").Document, discountAmount: number }>}
 * @throws {PricingError}
 */
async function validatePromoCode({ code, userId, subtotal }) {
  if (!code || !String(code).trim()) {
    throw new PricingError("Promo code is required", "PROMO_NOT_FOUND");
  }

  const normalizedCode = String(code).trim().toUpperCase().replace(/\s+/g, "");
  const promo = await PromoCode.findOne({ code: normalizedCode, isDeleted: false });
  if (!promo) {
    throw new PricingError("Invalid promo code", "PROMO_NOT_FOUND");
  }

  if (promo.usedCount >= promo.usageLimit) {
    throw new PricingError("This promo code has reached its usage limit", "PROMO_USAGE_LIMIT_REACHED");
  }

  if (userId) {
    const userUsageCount = await PromoCodeUsage.countDocuments({ promoCode: promo._id, user_id: userId });
    if (userUsageCount >= promo.perUserLimit) {
      throw new PricingError(
        "You have already used this promo code the maximum number of times",
        "PROMO_PER_USER_LIMIT_REACHED"
      );
    }
  }

  const discountAmount = computePromoDiscountAmount({ promo, subtotal });

  return { promo, discountAmount };
}

module.exports = { validatePromoCode };
