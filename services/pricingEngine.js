/**
 * Pricing Engine — single source of truth for all monetary calculations.
 *
 * Formula:
 *   Subtotal        = Service Amount + Pickup Charges + Drop Charges + Towing Charge
 *   Tax             = Subtotal × Dealer.tax %
 *   Customer Total  = Subtotal + Tax
 *   Commission      = Subtotal × Dealer.commission %
 *   Dealer Earnings = Subtotal − Commission
 *
 * Tax is collected from the customer but belongs to platform accounting —
 * it is never part of Dealer Earnings.
 *
 * No values here are ever hardcoded — tax %, commission %, pickupCharges,
 * dropCharges and towingCharges always come from the Dealer document passed
 * in by the caller (or, for towing, from an explicit dealer/admin override on
 * an existing booking — see resolveTowingCharge()).
 *
 * Every caller in the backend (booking creation, live quote, bill generation,
 * wallet settlement) MUST route through this module instead of re-deriving
 * these numbers itself.
 */

const PRICING_VERSION = 1;

const TRANSPORT_OPTIONS = Object.freeze({
  SELF_VISIT: "SELF_VISIT",
  PICKUP_ONLY: "PICKUP_ONLY",
  DROP_ONLY: "DROP_ONLY",
  PICKUP_AND_DROP: "PICKUP_AND_DROP",
});

/**
 * Condition the customer declares for their bike during booking. Only
 * RIDEABLE can reach the garage under its own power — the other two require
 * the bike to be towed, which is what drives the towing charge below.
 *
 * RIDEABLE is the default for any booking (and every booking created before
 * this field existed), so legacy bookings read back as "no towing required".
 */
const BIKE_CONDITIONS = Object.freeze({
  RIDEABLE: "RIDEABLE",
  NOT_RIDEABLE: "NOT_RIDEABLE",
  COMPLETELY_DEAD: "COMPLETELY_DEAD",
});

const TOWING_REQUIRED_CONDITIONS = Object.freeze([
  BIKE_CONDITIONS.NOT_RIDEABLE,
  BIKE_CONDITIONS.COMPLETELY_DEAD,
]);

// Upper bound for a manually entered towing charge. Purely a typo guard
// (a dealer fat-fingering an extra zero); the real authority on what is
// charged stays the dealer's configured rate.
const MAX_TOWING_CHARGE = 100000;

class PricingError extends Error {
  constructor(message, code = "PRICING_ERROR") {
    super(message);
    this.name = "PricingError";
    this.code = code;
    this.statusCode = 400;
  }
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Resolve the price of a single AdminService/additional-service document for
 * a given bike CC. `doc.bikes` is the per-CC pricing table on the service.
 */
function resolvePriceForCC(doc, bikeCC) {
  if (!doc || !Array.isArray(doc.bikes)) return 0;
  const cc = Number(bikeCC);
  const match = doc.bikes.find((b) => Number(b.cc) === cc);
  return match ? Number(match.price) || 0 : 0;
}

/**
 * Sum the CC-matched price of every main + additional service. This is the
 * single place service pricing is resolved — replaces the duplicated
 * per-service-loop that used to live in controller/booking.js and
 * controller/payment.js.
 */
function resolveServiceAmount({ services = [], additionalServices = [], bikeCC }) {
  let amount = 0;
  for (const svc of services) amount += resolvePriceForCC(svc, bikeCC);
  for (const svc of additionalServices) amount += resolvePriceForCC(svc, bikeCC);
  return round2(amount);
}

/**
 * Apply the dealer's pickup/drop charges for the requested transport option.
 * Rejects any option the dealer does not actually support.
 */
function computeTransportCharges({ transportOption, dealer }) {
  if (!transportOption || !TRANSPORT_OPTIONS[transportOption]) {
    throw new PricingError(
      `Unsupported transportOption: ${transportOption}`,
      "INVALID_TRANSPORT_OPTION"
    );
  }

  const dealerPickupCharges = Number(dealer?.pickupCharges) || 0;
  const dealerDropCharges = Number(dealer?.dropCharges) || 0;
  const providesPickup = Boolean(dealer?.providesPickup);
  const providesDrop = Boolean(dealer?.providesDrop);

  switch (transportOption) {
    case TRANSPORT_OPTIONS.SELF_VISIT:
      return { pickupCharges: 0, dropCharges: 0 };

    case TRANSPORT_OPTIONS.PICKUP_ONLY:
      if (!providesPickup) {
        throw new PricingError(
          "This dealer does not offer pickup service",
          "PICKUP_NOT_SUPPORTED"
        );
      }
      return { pickupCharges: dealerPickupCharges, dropCharges: 0 };

    case TRANSPORT_OPTIONS.DROP_ONLY:
      if (!providesDrop) {
        throw new PricingError(
          "This dealer does not offer drop service",
          "DROP_NOT_SUPPORTED"
        );
      }
      return { pickupCharges: 0, dropCharges: dealerDropCharges };

    case TRANSPORT_OPTIONS.PICKUP_AND_DROP:
      if (!providesPickup || !providesDrop) {
        throw new PricingError(
          "This dealer does not offer pickup & drop service",
          "PICKUP_DROP_NOT_SUPPORTED"
        );
      }
      return { pickupCharges: dealerPickupCharges, dropCharges: dealerDropCharges };

    default:
      throw new PricingError(
        `Unsupported transportOption: ${transportOption}`,
        "INVALID_TRANSPORT_OPTION"
      );
  }
}

/**
 * Normalise whatever a client sent as `bikeCondition` into a supported value.
 * Missing/empty means RIDEABLE — that is what every booking created before
 * this field existed implicitly was, so legacy clients keep working unchanged.
 * Anything else present but unrecognised is a client bug, not a default.
 */
function normalizeBikeCondition(bikeCondition) {
  if (bikeCondition === undefined || bikeCondition === null || bikeCondition === "") {
    return BIKE_CONDITIONS.RIDEABLE;
  }
  const value = String(bikeCondition).trim().toUpperCase();
  if (!BIKE_CONDITIONS[value]) {
    throw new PricingError(
      `Unsupported bikeCondition: ${bikeCondition}`,
      "INVALID_BIKE_CONDITION"
    );
  }
  return value;
}

/**
 * Towing is required by the declared condition of the bike, never by a
 * client-supplied boolean — a customer app could otherwise flip the flag off
 * and dodge the charge. Always derive it here.
 */
function isTowingRequired(bikeCondition) {
  return TOWING_REQUIRED_CONDITIONS.includes(normalizeBikeCondition(bikeCondition));
}

/**
 * Resolve the towing charge for a booking.
 *
 * - No towing required -> always 0, whatever anyone passes.
 * - `override` (a dealer/admin editing the charge on an existing booking,
 *   see controller/booking.js#updateTowingCharge) wins when supplied.
 * - Otherwise it is the dealer's configured rate, and only when the dealer
 *   actually offers towing. A dealer who hasn't enabled it starts at 0 and
 *   can add the real amount later once they have quoted the customer —
 *   the booking is never blocked over it.
 */
function resolveTowingCharge({ towingRequired, dealer, override = null }) {
  if (!towingRequired) return 0;

  if (override !== null && override !== undefined && override !== "") {
    const value = Number(override);
    if (!Number.isFinite(value) || value < 0) {
      throw new PricingError("Towing charge must be a non-negative number", "INVALID_TOWING_CHARGE");
    }
    if (value > MAX_TOWING_CHARGE) {
      throw new PricingError(
        `Towing charge cannot exceed ₹${MAX_TOWING_CHARGE}`,
        "TOWING_CHARGE_TOO_LARGE"
      );
    }
    return round2(value);
  }

  if (!dealer?.providesTowing) return 0;
  return round2(Number(dealer?.towingCharges) || 0);
}

/**
 * Compute the discount a promo code is worth against a given subtotal. Pure —
 * takes an already-fetched PromoCode document/lean object and performs no DB
 * access itself. Usage-limit / per-user-limit checks require querying
 * PromoCodeUsage, so those live in services/promoService.js and must pass
 * BEFORE this is called; everything checkable from the promo document alone
 * (active flag, validity window, minimum order) is enforced here so it can
 * never be bypassed by a caller that forgets to check.
 *
 * Throws PricingError with a specific `code` for every rule violated — the
 * caller returns `error.message` verbatim to the client. The frontend must
 * never compute a discount itself; this is the single source of truth.
 */
function computePromoDiscountAmount({ promo, subtotal }) {
  if (!promo || promo.isDeleted) {
    throw new PricingError("Invalid promo code", "PROMO_NOT_FOUND");
  }
  if (!promo.isActive) {
    throw new PricingError("This promo code is not active", "PROMO_INACTIVE");
  }

  const now = new Date();
  if (promo.validFrom && now < new Date(promo.validFrom)) {
    throw new PricingError("This promo code is not valid yet", "PROMO_NOT_STARTED");
  }
  if (promo.validTo && now > new Date(promo.validTo)) {
    throw new PricingError("This promo code has expired", "PROMO_EXPIRED");
  }

  const amount = round2(Number(subtotal) || 0);
  if (promo.minOrder !== null && promo.minOrder !== undefined && amount < Number(promo.minOrder)) {
    throw new PricingError(
      `Minimum booking amount of ₹${promo.minOrder} required for this promo code`,
      "PROMO_MIN_ORDER_NOT_MET"
    );
  }

  let discount =
    promo.discountType === "percentage"
      ? round2((amount * Number(promo.discountValue)) / 100)
      : round2(Number(promo.discountValue));

  if (promo.maxDiscount !== null && promo.maxDiscount !== undefined) {
    discount = Math.min(discount, round2(Number(promo.maxDiscount)));
  }
  // Never discount more than the booking is actually worth.
  discount = Math.min(discount, amount);

  if (discount <= 0) {
    throw new PricingError("This promo code does not apply any discount", "PROMO_ZERO_DISCOUNT");
  }

  return discount;
}

/**
 * Compute the full price breakdown for a booking or a live quote.
 *
 * `discountAmount` is accepted directly for callers that already know a
 * discount (kept for applyRewardDiscount's use elsewhere). Passing `promo`
 * (an already-fetched PromoCode doc) folds a promo-code discount into the
 * same `discountAmount`/`amountDue` mechanism and stamps the promo snapshot
 * fields onto the returned breakdown so applyBreakdownToBooking() can lock
 * them onto the Booking at creation time.
 */
function computePriceBreakdown({
  serviceAmount,
  transportOption,
  dealer,
  discountAmount = 0,
  promo = null,
  bikeCondition = BIKE_CONDITIONS.RIDEABLE,
  towingChargeOverride = null,
}) {
  const amount = round2(Number(serviceAmount) || 0);

  const { pickupCharges, dropCharges } = computeTransportCharges({ transportOption, dealer });

  // Towing sits alongside pickup/drop: a transport charge that is part of the
  // subtotal, so it is taxed and commissioned exactly like they are, and shows
  // as its own line on the bill rather than being folded into the service.
  const condition = normalizeBikeCondition(bikeCondition);
  const towingRequired = isTowingRequired(condition);
  const towingCharge = resolveTowingCharge({
    towingRequired,
    dealer,
    override: towingChargeOverride,
  });

  const subtotal = round2(amount + pickupCharges + dropCharges + towingCharge);

  const taxRate = Number(dealer?.tax) || 0;
  const taxAmount = round2((subtotal * taxRate) / 100);
  const customerTotal = round2(subtotal + taxAmount);

  const commissionRate = Number(dealer?.commission) || 0;
  const commissionAmount = round2((subtotal * commissionRate) / 100);
  const dealerEarnings = round2(subtotal - commissionAmount);

  let promoDiscountAmount = 0;
  let promoCodeId = null;
  let promoCode = null;
  let promoName = null;
  let promoDiscountType = null;
  let promoDiscountValue = null;

  if (promo) {
    promoDiscountAmount = computePromoDiscountAmount({ promo, subtotal });
    promoCodeId = promo._id;
    promoCode = promo.code;
    promoName = promo.name;
    promoDiscountType = promo.discountType;
    promoDiscountValue = promo.discountValue;
  }

  const discount = round2((Number(discountAmount) || 0) + promoDiscountAmount);

  return {
    transportOption,
    serviceAmount: amount,
    pickupCharges: round2(pickupCharges),
    dropCharges: round2(dropCharges),
    bikeCondition: condition,
    towingRequired,
    towingCharge,
    subtotal,
    taxRate,
    taxAmount,
    customerTotal,
    commissionRate,
    commissionAmount,
    dealerEarnings,
    discountAmount: discount,
    pricingVersion: PRICING_VERSION,
    promoCodeId,
    promoCode,
    promoName,
    promoDiscountType,
    promoDiscountValue,
    promoDiscountAmount,
  };
}

/**
 * Every Booking field that holds a money/rate value computed by this engine.
 * These are locked at the schema level (models/Booking.js) once a booking
 * exists — no controller may set them via generic field assignment. The
 * ONLY way to legitimately change them post-creation is through
 * applyBreakdownToBooking()/applyRewardDiscount() below, which flip the
 * document's internal bypass flag the schema guard checks for.
 */
const PRICING_SNAPSHOT_FIELDS = Object.freeze([
  "serviceAmount",
  "pickupCharges",
  "dropCharges",
  "towingCharge",
  "subtotal",
  "taxRate",
  "taxAmount",
  "customerTotal",
  "commissionRate",
  "commissionAmount",
  "dealerEarnings",
  "discountAmount",
  "pricingVersion",
  "priceSnapshotAt",
  // Promo code snapshot — set once at creation via applyBreakdownToBooking()
  // when a promo was supplied; immutable for the same reason as every other
  // field here (a promo can't be swapped after the customer saw the price).
  "promoCodeId",
  "promoCode",
  "promoName",
  "promoDiscountType",
  "promoDiscountValue",
  "promoDiscountAmount",
  // Legacy mirrors kept for backward-compatible readers (walletSettlement,
  // adminFinance/adminTransactions reporting) — same lock applies to them.
  "totalBill",
  "tax",
]);

// Internal flag name the Booking schema's pre-save/pre-update guards look
// for to allow a write to a locked field. Never set this directly from a
// controller — always go through applyBreakdownToBooking()/applyRewardDiscount().
const PRICING_WRITE_BYPASS_FLAG = "allowPricingWrite";

/**
 * Write a full computePriceBreakdown() result onto a Mongoose Booking
 * document (new or existing) and authorize the write past the schema's
 * immutability guard. This is the ONLY sanctioned way to set the pricing
 * snapshot fields on an existing booking (e.g. updateBooking() recomputing
 * after a service-list change). For brand-new documents this is optional —
 * the guard already allows first-save writes — but calling it keeps every
 * write site consistent.
 */
function applyBreakdownToBooking(bookingDoc, breakdown) {
  bookingDoc.transportOption = breakdown.transportOption;
  bookingDoc.serviceAmount = breakdown.serviceAmount;
  bookingDoc.pickupCharges = breakdown.pickupCharges;
  bookingDoc.dropCharges = breakdown.dropCharges;
  bookingDoc.towingCharge = breakdown.towingCharge;
  bookingDoc.subtotal = breakdown.subtotal;
  bookingDoc.taxRate = breakdown.taxRate;
  bookingDoc.taxAmount = breakdown.taxAmount;
  bookingDoc.customerTotal = breakdown.customerTotal;
  bookingDoc.commissionRate = breakdown.commissionRate;
  bookingDoc.commissionAmount = breakdown.commissionAmount;
  bookingDoc.dealerEarnings = breakdown.dealerEarnings;
  bookingDoc.discountAmount = breakdown.discountAmount;
  bookingDoc.pricingVersion = breakdown.pricingVersion;
  bookingDoc.priceSnapshotAt = new Date();

  if (breakdown.promoCodeId) {
    bookingDoc.promoCodeId = breakdown.promoCodeId;
    bookingDoc.promoCode = breakdown.promoCode;
    bookingDoc.promoName = breakdown.promoName;
    bookingDoc.promoDiscountType = breakdown.promoDiscountType;
    bookingDoc.promoDiscountValue = breakdown.promoDiscountValue;
    bookingDoc.promoDiscountAmount = breakdown.promoDiscountAmount;
  }

  // Legacy mirrors — kept for backward-compatible readers.
  bookingDoc.tax = breakdown.taxAmount;
  bookingDoc.totalBill = breakdown.subtotal;

  if (typeof bookingDoc.$locals === "object" && bookingDoc.$locals !== null) {
    bookingDoc.$locals[PRICING_WRITE_BYPASS_FLAG] = true;
  }
  return bookingDoc;
}

/**
 * Apply a reward-points (or any future coupon/offer) discount to an existing
 * booking WITHOUT touching subtotal, serviceAmount, commission or dealer
 * earnings — those are computed once at booking creation and never move.
 * Only discountAmount changes; amountDue (a virtual, see models/Booking.js)
 * recomputes automatically as customerTotal - discountAmount.
 *
 * Throws PricingError if the discount would exceed the amount still due.
 */
function applyRewardDiscount(bookingDoc, additionalDiscount) {
  const addition = round2(Number(additionalDiscount) || 0);
  if (addition <= 0) {
    throw new PricingError("Discount amount must be greater than zero", "INVALID_DISCOUNT");
  }

  const customerTotal = Number(bookingDoc.customerTotal) || 0;
  const existingDiscount = Number(bookingDoc.discountAmount) || 0;
  const amountDue = round2(customerTotal - existingDiscount);

  if (addition > amountDue) {
    throw new PricingError(
      `Discount (${addition}) exceeds the amount still due (${amountDue})`,
      "DISCOUNT_EXCEEDS_AMOUNT_DUE"
    );
  }

  bookingDoc.discountAmount = round2(existingDiscount + addition);

  if (typeof bookingDoc.$locals === "object" && bookingDoc.$locals !== null) {
    bookingDoc.$locals[PRICING_WRITE_BYPASS_FLAG] = true;
  }
  return bookingDoc;
}

module.exports = {
  PRICING_VERSION,
  TRANSPORT_OPTIONS,
  BIKE_CONDITIONS,
  TOWING_REQUIRED_CONDITIONS,
  MAX_TOWING_CHARGE,
  PricingError,
  PRICING_SNAPSHOT_FIELDS,
  PRICING_WRITE_BYPASS_FLAG,
  round2,
  resolvePriceForCC,
  resolveServiceAmount,
  computeTransportCharges,
  normalizeBikeCondition,
  isTowingRequired,
  resolveTowingCharge,
  computePromoDiscountAmount,
  computePriceBreakdown,
  applyBreakdownToBooking,
  applyRewardDiscount,
};
