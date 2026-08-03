const AppBanner = require("../models/AppBanner");
const Banner = require("../models/banner_model");

function endOfDayUTC(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(23, 59, 59, 999);
  return date;
}

function appBannerFields(legacyBanner) {
  const banner = legacyBanner.toObject ? legacyBanner.toObject() : legacyBanner;
  const serviceId = banner.baseServiceId?._id || banner.baseServiceId;

  return {
    bannerType: "home",
    image: banner.banner_image,
    title: String(banner.name || banner.bannerId || "Banner").trim(),
    description: "",
    linkUrl: serviceId ? `service:${serviceId}` : "",
    displayOrder: Number.isFinite(Number(banner.displayOrder)) ? Number(banner.displayOrder) : 0,
    scheduleStart: banner.from_date || null,
    scheduleEnd: endOfDayUTC(banner.expiry_date),
    locationType: banner.locationType === "specific" ? "specific" : "all",
    placeName: banner.placeName || "",
    latitude: banner.latitude ?? null,
    longitude: banner.longitude ?? null,
    radiusKm: Number(banner.radius) > 0 ? Number(banner.radius) : 10,
    legacyBannerId: banner._id,
    isActive: banner.status !== "expired",
    isDeleted: false,
  };
}

async function syncLegacyBanner(legacyBanner) {
  if (!legacyBanner?._id || !legacyBanner.banner_image) return null;
  return AppBanner.findOneAndUpdate(
    { legacyBannerId: legacyBanner._id },
    { $set: appBannerFields(legacyBanner) },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function syncAllLegacyBanners() {
  const banners = await Banner.find({ banner_image: { $nin: [null, ""] } }).lean();
  if (!banners.length) return;

  await AppBanner.bulkWrite(
    banners.map((banner) => ({
      updateOne: {
        filter: { legacyBannerId: banner._id },
        update: { $set: appBannerFields(banner) },
        upsert: true,
      },
    })),
    { ordered: false }
  );
}

async function deleteSyncedLegacyBanner(legacyBannerId) {
  return AppBanner.updateOne(
    { legacyBannerId },
    { $set: { isDeleted: true, isActive: false } }
  );
}

module.exports = { syncLegacyBanner, syncAllLegacyBanners, deleteSyncedLegacyBanner };
