/**
 * Legal Controller (Preferences module)
 *
 * Manages the 8 legal/informational documents as singleton-per-docType
 * records (rich text HTML stored in `content`).
 *
 * Endpoints (mounted at /bikedoctor/preferences/legal):
 *   GET   /                    → getLegalDocuments   (all 8, auto-created on first access)
 *   GET   /:docType            → getLegalDocumentByType
 *   PUT   /:docType            → updateLegalDocument body: { content, isPublished } (upsert)
 *   PATCH /:docType/status     → toggleLegalDocumentStatus body: { status } (boolean isPublished)
 */

const LegalDocument = require("../../models/LegalDocument");
const { LEGAL_DOC_TYPES } = LegalDocument;

function isValidDocType(docType) {
  return LEGAL_DOC_TYPES.includes(docType);
}

// Ensures every catalog docType has a document (created empty/unpublished
// on first access) so the admin list always reflects the full fixed catalog.
async function ensureAllDocuments() {
  await LegalDocument.bulkWrite(
    LEGAL_DOC_TYPES.map((docType) => ({
      updateOne: {
        filter: { docType },
        update: { $setOnInsert: { docType, content: "", isPublished: false } },
        upsert: true,
      },
    }))
  );
}

const getLegalDocuments = async (req, res) => {
  try {
    await ensureAllDocuments();
    const documents = await LegalDocument.find({}).lean();
    return res.status(200).json({ success: true, data: documents });
  } catch (error) {
    console.error("getLegalDocuments error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getLegalDocumentByType = async (req, res) => {
  try {
    const { docType } = req.params;
    if (!isValidDocType(docType)) {
      return res.status(400).json({ success: false, message: `Invalid docType. Allowed: ${LEGAL_DOC_TYPES.join(", ")}` });
    }
    const document = await LegalDocument.findOneAndUpdate(
      { docType },
      { $setOnInsert: { docType, content: "", isPublished: false } },
      { new: true, upsert: true }
    );
    return res.status(200).json({ success: true, data: document });
  } catch (error) {
    console.error("getLegalDocumentByType error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const updateLegalDocument = async (req, res) => {
  try {
    const { docType } = req.params;
    if (!isValidDocType(docType)) {
      return res.status(400).json({ success: false, message: `Invalid docType. Allowed: ${LEGAL_DOC_TYPES.join(", ")}` });
    }
    const { content, isPublished } = req.body;
    if (content === undefined) {
      return res.status(400).json({ success: false, message: "content is required" });
    }

    const update = { content };
    if (isPublished !== undefined) update.isPublished = Boolean(isPublished);

    const document = await LegalDocument.findOneAndUpdate(
      { docType },
      { $set: update, $setOnInsert: { docType } },
      { new: true, upsert: true }
    );
    return res.status(200).json({ success: true, message: "Document updated successfully", data: document });
  } catch (error) {
    console.error("updateLegalDocument error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const toggleLegalDocumentStatus = async (req, res) => {
  try {
    const { docType } = req.params;
    const { status } = req.body;
    if (!isValidDocType(docType)) {
      return res.status(400).json({ success: false, message: `Invalid docType. Allowed: ${LEGAL_DOC_TYPES.join(", ")}` });
    }
    if (typeof status !== "boolean") {
      return res.status(400).json({ success: false, message: "status must be a boolean" });
    }
    const document = await LegalDocument.findOneAndUpdate(
      { docType },
      { $set: { isPublished: status }, $setOnInsert: { docType, content: "" } },
      { new: true, upsert: true }
    );
    return res.status(200).json({ success: true, message: "Document status updated", data: document });
  } catch (error) {
    console.error("toggleLegalDocumentStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getLegalDocuments,
  getLegalDocumentByType,
  updateLegalDocument,
  toggleLegalDocumentStatus,
};
