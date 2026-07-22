const jwt_decode = require("jwt-decode");
const AdminService = require("../models/adminService");
const Vendor = require("../models/dealerModel");
const {
  computePriceBreakdown,
  computeTransportCharges,
  resolveServiceAmount,
  round2,
  PricingError,
} = require("../services/pricingEngine");
const { validatePromoCode } = require("../services/promoService");

// POST /pricing/quote
//
// Live pricing preview — NO database writes. Any client (User App, Dealer
// App, Admin UI, or this backend itself) calls this to know what a booking
// would cost before committing to createBooking(). Also doubles as the
// "Apply Promo" call: pass `promoCode` to validate a code and see the
// discounted total before confirming — this never writes usage/PromoCodeUsage,
// it's a preview only (see controller/booking.js#createBooking for where a
// promo is actually locked onto a booking, and services/invoiceService.js
// for where its usage is finally counted, only after payment succeeds).
//
// Body: { dealerId, serviceIds: [AdminServiceId], additionalServiceIds?, transportOption, bikeCC, promoCode? }
// bikeCC is required to resolve per-CC service pricing (AdminService.bikes is
// keyed by cc) — not called out explicitly in the original spec's input list,
// but there is no way to price a service without it.
const getPricingQuote = async (req, res) => {
  try {
    const { dealerId, serviceIds, additionalServiceIds, transportOption, bikeCC, promoCode } = req.body;

    if (!dealerId) {
      return res.status(400).json({ success: false, message: "dealerId is required" });
    }
    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      return res.status(400).json({ success: false, message: "serviceIds must be a non-empty array" });
    }
    if (!transportOption) {
      return res.status(400).json({ success: false, message: "transportOption is required" });
    }
    if (bikeCC === undefined || bikeCC === null || bikeCC === "") {
      return res.status(400).json({ success: false, message: "bikeCC is required to resolve service pricing" });
    }

    const dealer = await Vendor.findById(dealerId)
      .select("tax commission pickupCharges dropCharges providesPickup providesDrop")
      .lean();
    if (!dealer) {
      return res.status(404).json({ success: false, message: "Dealer not found" });
    }

    const services = await AdminService.find({
      _id: { $in: serviceIds },
      dealer_id: dealerId,
      isActive: true,
    })
      .select("bikes")
      .lean();

    if (services.length === 0) {
      return res.status(400).json({ success: false, message: "No valid services found for this dealer" });
    }

    let additionalServices = [];
    if (Array.isArray(additionalServiceIds) && additionalServiceIds.length > 0) {
      const AdditionalService = require("../models/additionalServiceSchema");
      additionalServices = await AdditionalService.find({ _id: { $in: additionalServiceIds } })
        .select("bikes")
        .lean();
    }

    const serviceAmount = resolveServiceAmount({ services, additionalServices, bikeCC });

    let promo = null;
    if (promoCode) {
      let userId;
      try {
        userId = jwt_decode(req.headers.token)?.user_id;
      } catch (_) {
        userId = undefined;
      }
      // Resolve the real subtotal (service + pickup/drop) the same way
      // computePriceBreakdown will, so the minOrder/discount check below
      // matches exactly what the breakdown call further down computes.
      const { pickupCharges, dropCharges } = computeTransportCharges({ transportOption, dealer });
      const subtotal = round2(serviceAmount + pickupCharges + dropCharges);
      const validated = await validatePromoCode({ code: promoCode, userId, subtotal });
      promo = validated.promo;
    }

    const breakdown = computePriceBreakdown({ serviceAmount, transportOption, dealer, promo });

    return res.status(200).json({ success: true, data: breakdown });
  } catch (error) {
    if (error instanceof PricingError) {
      return res.status(400).json({ success: false, message: error.message, code: error.code });
    }
    console.error("[getPricingQuote] error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = { getPricingQuote };
