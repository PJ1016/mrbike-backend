const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../../middlewares/requireAdmin");
const {
  getFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  toggleFaqStatus,
  bulkDeleteFaqs,
} = require("../../controller/preferences/faqController");

router.get("/", requireAdmin, getFaqs);
router.post("/bulk-delete", requireAdmin, bulkDeleteFaqs);
router.post("/", requireAdmin, createFaq);
router.patch("/:id/status", requireAdmin, toggleFaqStatus);
router.put("/:id", requireAdmin, updateFaq);
router.delete("/:id", requireAdmin, deleteFaq);

module.exports = router;
