const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../../middlewares/requireAdmin");
const { createS3Upload } = require("../../utils/s3Upload");
const {
  getCampaigns,
  getCampaignById,
  getCampaignAnalytics,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  toggleCampaignStatus,
  sendCampaignNow,
  bulkDeleteCampaigns,
  bulkUpdateCampaignStatus,
} = require("../../controller/preferences/campaignController");

const upload = createS3Upload("campaigns");

router.get("/", requireAdmin, getCampaigns);
router.post("/bulk-delete", requireAdmin, bulkDeleteCampaigns);
router.post("/bulk-status", requireAdmin, bulkUpdateCampaignStatus);
router.post("/", requireAdmin, upload.single("image"), createCampaign);
router.get("/:id/analytics", requireAdmin, getCampaignAnalytics);
router.patch("/:id/status", requireAdmin, toggleCampaignStatus);
router.post("/:id/send-now", requireAdmin, sendCampaignNow);
router.get("/:id", requireAdmin, getCampaignById);
router.put("/:id", requireAdmin, upload.single("image"), updateCampaign);
router.delete("/:id", requireAdmin, deleteCampaign);

module.exports = router;
