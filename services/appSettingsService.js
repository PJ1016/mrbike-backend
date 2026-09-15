/**
 * Read side of the AppSettings singleton (models/AppSettings.js).
 *
 * The admin Preferences panel writes that document; everything else in the
 * backend reads it through here so the fallbacks live in exactly one place
 * and no controller has to remember them.
 */

const AppSettings = require("../models/AppSettings");

// MR Bike's own support / platform number. Printed on every invoice in place
// of the garage's number so a customer always reaches MR Bike support, never
// the dealer directly. Admin can override it from Preferences → App Settings
// (supportPhone); this is what ships when they haven't.
const MR_BIKE_SUPPORT_PHONE = "+91 7659 005 464";

// Same idea for the support mailbox printed alongside it. Admin can override
// from Preferences → App Settings (supportEmail).
const MR_BIKE_SUPPORT_EMAIL = "support@mrbikedoctor.com";

const DEFAULT_PLATFORM_FEE_LABEL = "Platform Fee";

// GST on MR Bike's commission, used when the settings document doesn't exist
// yet. 18% is the rate the business actually operates on; admin can change it
// from Preferences → App Settings.
const DEFAULT_COMMISSION_TAX_RATE = 18;

// Typo guard on the admin-entered fee — a flat convenience fee an order of
// magnitude above this is a mistyped amount, not a business decision.
const MAX_PLATFORM_FEE = 10000;

/**
 * The platform/convenience fee MR Bike adds to a customer's total, exactly as
 * pricingEngine.computePriceBreakdown() expects it. Returns a disabled config
 * (fee 0) when the settings document doesn't exist yet or the admin hasn't
 * switched the fee on, so pricing keeps working untouched until they do.
 */
/**
 * Everything pricingEngine.computePriceBreakdown() needs out of AppSettings,
 * in ONE read. Booking creation and the live quote both call this rather than
 * hitting the settings document twice for two numbers that always travel
 * together.
 */
async function getPricingSettings() {
  const settings = await AppSettings.findOne({})
    .select("platformFeeEnabled platformFeeAmount platformFeeLabel commissionTaxRate")
    .lean();

  const feeAmount = Number(settings?.platformFeeAmount) || 0;
  const feeOn = Boolean(settings?.platformFeeEnabled) && feeAmount > 0;

  const rate = Number(settings?.commissionTaxRate);

  return {
    platformFeeConfig: {
      enabled: feeOn,
      amount: feeOn ? feeAmount : 0,
      label: String(settings?.platformFeeLabel || "").trim() || DEFAULT_PLATFORM_FEE_LABEL,
    },
    // A settings document that has never been saved reads back as undefined
    // here, not 0 — so fall back to the default rather than silently dropping
    // the tax. An admin who genuinely wants no tax saves 0, which is kept.
    commissionTaxRate:
      Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_COMMISSION_TAX_RATE,
  };
}

/**
 * The platform fee alone, for callers that need nothing else.
 */
async function getPlatformFeeConfig() {
  const { platformFeeConfig } = await getPricingSettings();
  return platformFeeConfig;
}

/**
 * MR Bike's own support channels, as printed on every invoice. Never the
 * dealer's contact details — a customer with an invoice question reaches MR
 * Bike, not the garage.
 */
async function getSupportContact() {
  const settings = await AppSettings.findOne({})
    .select("supportPhone supportEmail")
    .lean();

  return {
    phone: String(settings?.supportPhone || "").trim() || MR_BIKE_SUPPORT_PHONE,
    email: String(settings?.supportEmail || "").trim() || MR_BIKE_SUPPORT_EMAIL,
  };
}

module.exports = {
  MR_BIKE_SUPPORT_PHONE,
  MR_BIKE_SUPPORT_EMAIL,
  DEFAULT_PLATFORM_FEE_LABEL,
  DEFAULT_COMMISSION_TAX_RATE,
  MAX_PLATFORM_FEE,
  getPricingSettings,
  getPlatformFeeConfig,
  getSupportContact,
};
