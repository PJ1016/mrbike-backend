const mongoose = require("mongoose");

const LEGAL_DOC_TYPES = [
  "user-privacy-policy",
  "user-terms-conditions",
  "dealer-privacy-policy",
  "dealer-terms-conditions",
  "refund-policy",
  "cancellation-policy",
  "about-us",
  "contact-us",
];

// One singleton document per docType. content stores rich-text/HTML as
// produced by the admin frontend's RichTextEditor.
const legalDocumentSchema = new mongoose.Schema(
  {
    docType: { type: String, enum: LEGAL_DOC_TYPES, required: true, unique: true },
    content: { type: String, default: "" },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LegalDocument", legalDocumentSchema);
module.exports.LEGAL_DOC_TYPES = LEGAL_DOC_TYPES;
