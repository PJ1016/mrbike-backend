const express = require("express");
const router = express.Router();

const {
  getPublicLegalDocuments,
  getPublicLegalDocumentByType,
  getPublicAppSettings,
  getPublicAppBanners,
} = require("../../controller/app/appContentController");

// Public, unauthenticated read-only endpoints for the customer mobile app.
// Mounted under /bikedoctor/app by routes/index.js.
router.get("/legal", getPublicLegalDocuments);
router.get("/legal/:docType", getPublicLegalDocumentByType);
router.get("/settings", getPublicAppSettings);
router.get("/banners/:bannerType", getPublicAppBanners);

module.exports = router;
