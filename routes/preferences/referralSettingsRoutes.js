const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../../middlewares/requireAdmin");
const {
  getReferralSettings,
  updateReferralSettings,
  getMrBikeMoneyServiceLimits,
  updateMrBikeMoneyServiceLimit,
} = require("../../controller/preferences/referralSettingsController");

router.get("/", requireAdmin, getReferralSettings);
router.put("/", requireAdmin, updateReferralSettings);
router.get("/service-limits", requireAdmin, getMrBikeMoneyServiceLimits);
router.put("/service-limits/:serviceId", requireAdmin, updateMrBikeMoneyServiceLimit);

module.exports = router;
