const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../../middlewares/requireAdmin");
const { getReferralSettings, updateReferralSettings } = require("../../controller/preferences/referralSettingsController");

router.get("/", requireAdmin, getReferralSettings);
router.put("/", requireAdmin, updateReferralSettings);

module.exports = router;
