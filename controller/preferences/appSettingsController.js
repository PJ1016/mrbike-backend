/**
 * App Content — App Settings Controller (Preferences module)
 *
 * Singleton document holding support contact info, social links,
 * store/website URLs, and the platform/convenience fee MR Bike charges
 * customers on top of the garage's amount.
 *
 * `supportPhone` is what gets printed on every invoice in place of the
 * dealer's number, and the platform-fee / commission-tax fields are read by
 * the pricing engine at booking time — both via
 * services/appSettingsService.js.
 *
 * Endpoints (mounted at /bikedoctor/preferences/app-settings):
 *   GET /   → getAppSettings  (auto-created on first access)
 *   PUT /   → updateAppSettings (JSON, upsert)
 */

const AppSettings = require("../../models/AppSettings");
const { MAX_PLATFORM_FEE, DEFAULT_PLATFORM_FEE_LABEL } = require("../../services/appSettingsService");
const { MAX_COMMISSION_TAX_RATE } = require("../../services/pricingEngine");

const SETTINGS_FIELDS = [
  "supportEmail",
  "supportPhone",
  "whatsappNumber",
  "supportHours",
  "facebookUrl",
  "instagramUrl",
  "twitterUrl",
  "youtubeUrl",
  "linkedinUrl",
  "websiteUrl",
  "playStoreUrl",
  "appStoreUrl",
  "customerAppLatestVersion",
  "customerAppUpdateMessage",
  "customerAppPlayStoreUrl",
  "customerAppStoreUrl",
  "providerAppLatestVersion",
  "providerAppUpdateMessage",
  "providerAppPlayStoreUrl",
  "providerAppStoreUrl",
];

const UPDATE_BOOLEAN_FIELDS = [
  "customerAppUpdateEnabled",
  "customerAppForceUpdate",
  "providerAppUpdateEnabled",
  "providerAppForceUpdate",
];

const VERSION_PATTERN = /^\d+(?:\.\d+){0,3}$/;

function applyAppUpdateSettings(settings, body) {
  for (const field of UPDATE_BOOLEAN_FIELDS) {
    if (body[field] !== undefined) settings[field] = Boolean(body[field]);
  }

  for (const prefix of ["customerApp", "providerApp"]) {
    const latestVersion = String(body[`${prefix}LatestVersion`] ?? settings[`${prefix}LatestVersion`] ?? "").trim();
    const updateEnabled = body[`${prefix}UpdateEnabled`] === undefined
      ? Boolean(settings[`${prefix}UpdateEnabled`])
      : Boolean(body[`${prefix}UpdateEnabled`]);

    if (updateEnabled && !VERSION_PATTERN.test(latestVersion)) {
      return `${prefix === "customerApp" ? "Customer" : "Provider"} latest version must look like 1.0.0`;
    }
  }

  return null;
}

// The platform fee and the commission tax rate are money/rates, not display
// strings, so they are validated and normalised here instead of being copied
// through with the fields above. See services/pricingEngine.js for what the
// backend does with them.
function applyPlatformFee(settings, body) {
  if (body.platformFeeEnabled !== undefined) {
    settings.platformFeeEnabled = Boolean(body.platformFeeEnabled);
  }

  if (body.platformFeeAmount !== undefined) {
    const amount = Number(body.platformFeeAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      return "Platform fee must be a non-negative number";
    }
    if (amount > MAX_PLATFORM_FEE) {
      return `Platform fee cannot exceed ₹${MAX_PLATFORM_FEE}`;
    }
    settings.platformFeeAmount = Math.round(amount * 100) / 100;
  }

  if (body.platformFeeLabel !== undefined) {
    settings.platformFeeLabel =
      String(body.platformFeeLabel || "").trim() || DEFAULT_PLATFORM_FEE_LABEL;
  }

  return null;
}

// GST MR Bike charges dealers on its commission. Changing it affects NEW
// bookings only — every existing booking replays the rate it was created
// with (services/pricingEngine.js#resolveCommissionTaxRate).
function applyCommissionTax(settings, body) {
  if (body.commissionTaxRate === undefined) return null;

  const rate = Number(body.commissionTaxRate);
  if (!Number.isFinite(rate) || rate < 0) {
    return "Commission tax rate must be a non-negative percentage";
  }
  if (rate > MAX_COMMISSION_TAX_RATE) {
    return `Commission tax rate cannot exceed ${MAX_COMMISSION_TAX_RATE}%`;
  }
  settings.commissionTaxRate = Math.round(rate * 100) / 100;
  return null;
}

async function getSingleton() {
  let settings = await AppSettings.findOne({});
  if (!settings) settings = await AppSettings.create({});
  return settings;
}

const getAppSettings = async (req, res) => {
  try {
    const settings = await getSingleton();
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error("getAppSettings error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const updateAppSettings = async (req, res) => {
  try {
    const settings = await getSingleton();
    for (const field of SETTINGS_FIELDS) {
      if (req.body[field] !== undefined) settings[field] = req.body[field];
    }

    const appUpdateError = applyAppUpdateSettings(settings, req.body);
    if (appUpdateError) {
      return res.status(400).json({ success: false, message: appUpdateError });
    }

    const platformFeeError = applyPlatformFee(settings, req.body);
    if (platformFeeError) {
      return res.status(400).json({ success: false, message: platformFeeError });
    }

    const commissionTaxError = applyCommissionTax(settings, req.body);
    if (commissionTaxError) {
      return res.status(400).json({ success: false, message: commissionTaxError });
    }

    await settings.save();
    return res.status(200).json({ success: true, message: "App settings updated successfully", data: settings });
  } catch (error) {
    console.error("updateAppSettings error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { getAppSettings, updateAppSettings };
