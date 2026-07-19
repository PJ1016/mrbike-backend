const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../../middlewares/requireAdmin");
const {
  getPromoCodes,
  generateCode,
  getPromoCodeById,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  togglePromoCodeStatus,
  bulkDeletePromoCodes,
  bulkUpdatePromoCodeStatus,
} = require("../../controller/preferences/promoCodeController");

router.get("/", requireAdmin, getPromoCodes);
router.get("/generate-code", requireAdmin, generateCode);
router.post("/bulk-delete", requireAdmin, bulkDeletePromoCodes);
router.post("/bulk-status", requireAdmin, bulkUpdatePromoCodeStatus);
router.post("/", requireAdmin, createPromoCode);
router.patch("/:id/status", requireAdmin, togglePromoCodeStatus);
router.get("/:id", requireAdmin, getPromoCodeById);
router.put("/:id", requireAdmin, updatePromoCode);
router.delete("/:id", requireAdmin, deletePromoCode);

module.exports = router;
