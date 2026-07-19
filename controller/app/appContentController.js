/**
 * Public App Content Controller
 *
 * Read-only, unauthenticated mirrors of the Preferences module for the
 * customer-facing mobile app. Reuses the same LegalDocument / AppSettings /
 * AppBanner models as controller/preferences/* — no new models, no writes.
 * Only published / active records are ever returned here.
 */

const LegalDocument = require("../../models/LegalDocument");
const AppSettings = require("../../models/AppSettings");
const AppBanner = require("../../models/AppBanner");
const Faq = require("../../models/Faq");
const { LEGAL_DOC_TYPES } = LegalDocument;
const { BANNER_TYPES } = AppBanner;

function isValidDocType(docType) {
  return LEGAL_DOC_TYPES.includes(docType);
}

function isValidBannerType(bannerType) {
  return BANNER_TYPES.includes(bannerType);
}

const getPublicLegalDocuments = async (req, res) => {
  try {
    const documents = await LegalDocument.find({ isPublished: true }).lean();
    return res.status(200).json({ success: true, data: documents });
  } catch (error) {
    console.error("getPublicLegalDocuments error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getPublicLegalDocumentByType = async (req, res) => {
  try {
    const { docType } = req.params;
    if (!isValidDocType(docType)) {
      return res.status(400).json({ success: false, message: `Invalid docType. Allowed: ${LEGAL_DOC_TYPES.join(", ")}` });
    }
    const document = await LegalDocument.findOne({ docType, isPublished: true }).lean();
    if (!document) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }
    return res.status(200).json({ success: true, data: document });
  } catch (error) {
    console.error("getPublicLegalDocumentByType error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getPublicAppSettings = async (req, res) => {
  try {
    const settings = await AppSettings.findOne({}).lean();
    return res.status(200).json({ success: true, data: settings || {} });
  } catch (error) {
    console.error("getPublicAppSettings error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getPublicAppBanners = async (req, res) => {
  try {
    const { bannerType } = req.params;
    if (!isValidBannerType(bannerType)) {
      return res.status(400).json({ success: false, message: `Invalid bannerType. Allowed: ${BANNER_TYPES.join(", ")}` });
    }
    const now = new Date();
    const data = await AppBanner.find({
      bannerType,
      isDeleted: false,
      isActive: true,
      $and: [
        { $or: [{ scheduleStart: null }, { scheduleStart: { $lte: now } }] },
        { $or: [{ scheduleEnd: null }, { scheduleEnd: { $gte: now } }] },
      ],
    })
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("getPublicAppBanners error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getPublicFaqs = async (req, res) => {
  try {
    const data = await Faq.find({ isDeleted: false, isActive: true })
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("getPublicFaqs error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getPublicLegalDocuments,
  getPublicLegalDocumentByType,
  getPublicAppSettings,
  getPublicAppBanners,
  getPublicFaqs,
};
