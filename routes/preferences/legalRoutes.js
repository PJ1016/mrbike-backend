const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../../middlewares/requireAdmin");
const {
  getLegalDocuments,
  getLegalDocumentByType,
  updateLegalDocument,
  toggleLegalDocumentStatus,
} = require("../../controller/preferences/legalController");

router.get("/", requireAdmin, getLegalDocuments);
router.patch("/:docType/status", requireAdmin, toggleLegalDocumentStatus);
router.get("/:docType", requireAdmin, getLegalDocumentByType);
router.put("/:docType", requireAdmin, updateLegalDocument);

module.exports = router;
