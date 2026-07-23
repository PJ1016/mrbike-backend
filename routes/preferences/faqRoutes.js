const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../../middlewares/requireAdmin");
const { createS3Upload } = require("../../utils/s3Upload");
const {
  getFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  toggleFaqStatus,
  bulkDeleteFaqs,
  uploadFaqImage,
} = require("../../controller/preferences/faqController");

const faqImageUpload = createS3Upload("faq-images");

router.get("/", requireAdmin, getFaqs);
router.post("/bulk-delete", requireAdmin, bulkDeleteFaqs);
router.post("/upload-image", requireAdmin, faqImageUpload.single("image"), uploadFaqImage);
router.post("/", requireAdmin, createFaq);
router.patch("/:id/status", requireAdmin, toggleFaqStatus);
router.put("/:id", requireAdmin, updateFaq);
router.delete("/:id", requireAdmin, deleteFaq);

module.exports = router;
