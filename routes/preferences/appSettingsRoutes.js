const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../../middlewares/requireAdmin");
const { getAppSettings, updateAppSettings } = require("../../controller/preferences/appSettingsController");

router.get("/", requireAdmin, getAppSettings);
router.put("/", requireAdmin, updateAppSettings);

module.exports = router;
