// Aggregates all Preferences module routes, mounted under /bikedoctor/preferences
// by routes/index.js — matches the admin frontend's prefApiClient.js base path.
const express = require("express");
const router = express.Router();

router.use("/campaigns", require("./campaignRoutes"));
router.use("/promo-codes", require("./promoCodeRoutes"));
router.use("/reward-rules", require("./rewardRuleRoutes"));
router.use("/legal", require("./legalRoutes"));
router.use("/app-banners", require("./appBannerRoutes"));
router.use("/faq", require("./faqRoutes"));
router.use("/app-settings", require("./appSettingsRoutes"));

module.exports = router;
