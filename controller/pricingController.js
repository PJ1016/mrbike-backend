const AdminService = require("../models/adminService");
const Vendor = require("../models/dealerModel");
const {
  computePriceBreakdown,
  resolveServiceAmount,
  PricingError,
} = require("../services/pricingEngine");

// POST /pricing/quote
//
// Live pricing preview — NO database writes. Any client (User App, Dealer
// App, Admin UI, or this backend itself) calls this to know what a booking
// would cost before committing to createBooking().
//
// Body: { dealerId, serviceIds: [AdminServiceId], additionalServiceIds?, transportOption, bikeCC }
// bikeCC is required to resolve per-CC service pricing (AdminService.bikes is
// keyed by cc) — not called out explicitly in the original spec's input list,
// but there is no way to price a service without it.
const getPricingQuote = async (req, res) => {
  try {
    const { dealerId, serviceIds, additionalServiceIds, transportOption, bikeCC } = req.body;

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
    const breakdown = computePriceBreakdown({ serviceAmount, transportOption, dealer });

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
