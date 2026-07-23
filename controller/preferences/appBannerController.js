/**
 * App Content — Banners Controller (Preferences module)
 *
 * Endpoints (mounted at /bikedoctor/preferences/app-banners):
 *   GET    /:bannerType                → getAppBanners
 *   POST   /:bannerType                → createAppBanner       (multipart, field "image")
 *   PUT    /:bannerType/:id            → updateAppBanner       (multipart, field "image")
 *   DELETE /:bannerType/:id            → deleteAppBanner       (soft delete)
 *   PATCH  /:bannerType/:id/status     → toggleAppBannerStatus body: { status } (boolean)
 *   POST   /:bannerType/bulk-delete    → bulkDeleteAppBanners  body: { ids }
 */

const mongoose = require("mongoose");
const AppBanner = require("../../models/AppBanner");
const { BANNER_TYPES } = AppBanner;
const { deleteS3Object } = require("../../utils/s3Upload");

function isValidBannerType(bannerType) {
  return BANNER_TYPES.includes(bannerType);
}

// scheduleEnd comes in as a date-only string (e.g. "2026-07-23") from the
// admin date picker. `new Date(dateString)` alone parses to 00:00:00 UTC of
// that day, which made banners expire at the start of their end date instead
// of the end of it. Normalize to 23:59:59.999 UTC of the same calendar day so
// the banner stays visible through its whole end date.
function endOfDayUTC(dateInput) {
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

const getAppBanners = async (req, res) => {
  try {
    const { bannerType } = req.params;
    if (!isValidBannerType(bannerType)) {
      return res.status(400).json({ success: false, message: `Invalid bannerType. Allowed: ${BANNER_TYPES.join(", ")}` });
    }
    const { page, limit, isActive } = req.query;
    const filter = { bannerType, isDeleted: false };
    if (isActive !== undefined) filter.isActive = isActive === "true";

    if (!page && !limit) {
      const data = await AppBanner.find(filter).sort({ displayOrder: 1, createdAt: -1 }).lean();
      return res.status(200).json({ success: true, data });
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      AppBanner.find(filter).sort({ displayOrder: 1, createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      AppBanner.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("getAppBanners error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const createAppBanner = async (req, res) => {
  try {
    const { bannerType } = req.params;
    if (!isValidBannerType(bannerType)) {
      return res.status(400).json({ success: false, message: `Invalid bannerType. Allowed: ${BANNER_TYPES.join(", ")}` });
    }
    const { title, linkUrl, displayOrder, scheduleStart, scheduleEnd, isActive } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ success: false, message: "Title is required" });
    if (!req.file) return res.status(400).json({ success: false, message: "Banner image is required" });

    const banner = await AppBanner.create({
      bannerType,
      title: title.trim(),
      image: req.file.location,
      linkUrl: linkUrl || "",
      displayOrder: displayOrder !== undefined ? Number(displayOrder) : 0,
      scheduleStart: scheduleStart ? new Date(scheduleStart) : null,
      scheduleEnd: scheduleEnd ? endOfDayUTC(scheduleEnd) : null,
      isActive: isActive !== undefined ? isActive === "true" || isActive === true : true,
    });

    return res.status(201).json({ success: true, message: "Banner created successfully", data: banner });
  } catch (error) {
    console.error("createAppBanner error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const updateAppBanner = async (req, res) => {
  try {
    const { bannerType, id } = req.params;
    if (!isValidBannerType(bannerType)) {
      return res.status(400).json({ success: false, message: `Invalid bannerType. Allowed: ${BANNER_TYPES.join(", ")}` });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid banner id" });
    }
    const banner = await AppBanner.findOne({ _id: id, bannerType, isDeleted: false });
    if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });

    const { title, linkUrl, displayOrder, scheduleStart, scheduleEnd, isActive } = req.body;
    if (title !== undefined) banner.title = title.trim();
    if (linkUrl !== undefined) banner.linkUrl = linkUrl;
    if (displayOrder !== undefined) banner.displayOrder = Number(displayOrder);
    if (scheduleStart !== undefined) banner.scheduleStart = scheduleStart ? new Date(scheduleStart) : null;
    if (scheduleEnd !== undefined) banner.scheduleEnd = scheduleEnd ? endOfDayUTC(scheduleEnd) : null;
    if (isActive !== undefined) banner.isActive = isActive === "true" || isActive === true;

    if (req.file) {
      const oldImage = banner.image;
      banner.image = req.file.location;
      deleteS3Object(oldImage);
    }

    await banner.save();
    return res.status(200).json({ success: true, message: "Banner updated successfully", data: banner });
  } catch (error) {
    console.error("updateAppBanner error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const deleteAppBanner = async (req, res) => {
  try {
    const { bannerType, id } = req.params;
    if (!isValidBannerType(bannerType)) {
      return res.status(400).json({ success: false, message: `Invalid bannerType. Allowed: ${BANNER_TYPES.join(", ")}` });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid banner id" });
    }
    const banner = await AppBanner.findOneAndUpdate(
      { _id: id, bannerType, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });
    return res.status(200).json({ success: true, message: "Banner deleted successfully" });
  } catch (error) {
    console.error("deleteAppBanner error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const toggleAppBannerStatus = async (req, res) => {
  try {
    const { bannerType, id } = req.params;
    const { status } = req.body;
    if (!isValidBannerType(bannerType)) {
      return res.status(400).json({ success: false, message: `Invalid bannerType. Allowed: ${BANNER_TYPES.join(", ")}` });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid banner id" });
    }
    if (typeof status !== "boolean") {
      return res.status(400).json({ success: false, message: "status must be a boolean" });
    }
    const banner = await AppBanner.findOneAndUpdate(
      { _id: id, bannerType, isDeleted: false },
      { isActive: status },
      { new: true }
    );
    if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });
    return res.status(200).json({ success: true, message: "Banner status updated", data: banner });
  } catch (error) {
    console.error("toggleAppBannerStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const bulkDeleteAppBanners = async (req, res) => {
  try {
    const { bannerType } = req.params;
    const { ids } = req.body;
    if (!isValidBannerType(bannerType)) {
      return res.status(400).json({ success: false, message: `Invalid bannerType. Allowed: ${BANNER_TYPES.join(", ")}` });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "ids array is required" });
    }
    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    await AppBanner.updateMany({ _id: { $in: validIds }, bannerType }, { isDeleted: true });
    return res.status(200).json({ success: true, message: "Banners deleted successfully" });
  } catch (error) {
    console.error("bulkDeleteAppBanners error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getAppBanners,
  createAppBanner,
  updateAppBanner,
  deleteAppBanner,
  toggleAppBannerStatus,
  bulkDeleteAppBanners,
};
