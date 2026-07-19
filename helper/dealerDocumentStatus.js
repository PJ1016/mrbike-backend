// Document Re-Verification status helpers. Builds a per-document + overall
// verification summary from a Vendor document using the existing
// documentVerification / documentRequests / documents / bankDetails fields —
// no schema changes, purely a read-side projection.
//
// documentVerification.<key> is the single source of truth for a document's
// review state (none|pending|verified|rejected|requested), already written by
// controller/dealerAuth.js's uploadDocuments()/verifyDocument() and
// routes/dealerRoutes.js's editDealer. documentRequests.<key> holds the
// latest outstanding admin note (reason/requestedBy/requestedAt) for a
// document that still needs dealer action (rejected or requested).

const DOCUMENT_TYPES = [
  { key: "aadharFront", label: "Aadhaar Front", filePath: "documents.aadharFront" },
  { key: "aadharBack", label: "Aadhaar Back", filePath: "documents.aadharBack" },
  { key: "pan", label: "PAN Card", filePath: "documents.panCardFront" },
  { key: "shop", label: "Shop Certificate", filePath: "documents.shopCertificate" },
  { key: "face", label: "Face Verification", filePath: "documents.faceVerificationImage" },
  { key: "passbook", label: "Bank Passbook", filePath: "bankDetails.passbookImage" },
];

const NEEDS_ACTION_STATUSES = ["rejected", "requested"];

function getAtPath(obj, dottedPath) {
  return dottedPath.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function toPlainMap(mapLike) {
  if (!mapLike) return {};
  if (typeof mapLike.toObject === "function") return mapLike.toObject();
  if (mapLike instanceof Map) return Object.fromEntries(mapLike);
  return mapLike;
}

// Builds the per-document list plus an overall rollup status:
//  - "action_required": at least one document is rejected or requested
//  - "waiting_for_review": nothing needs dealer action, but at least one is pending admin review
//  - "verified": every reviewable document is verified
//  - "not_submitted": no document has been uploaded/reviewed yet
function buildVerificationStatus(vendor) {
  const dv = toPlainMap(vendor.documentVerification);
  const requests = toPlainMap(vendor.documentRequests);

  const documents = DOCUMENT_TYPES.map(({ key, label, filePath }) => {
    const status = dv[key] || "none";
    const request = requests[key];
    return {
      documentType: key,
      label,
      fileUrl: getAtPath(vendor, filePath) || null,
      status,
      reason: request?.reason || null,
      reviewedBy: request?.requestedBy || null,
      reviewedAt: request?.requestedAt || null,
    };
  });

  const approvedDocuments = documents.filter((d) => d.status === "verified");
  const pendingDocuments = documents.filter((d) => d.status === "pending");
  const rejectedDocuments = documents.filter((d) => NEEDS_ACTION_STATUSES.includes(d.status));
  const untouchedDocuments = documents.filter((d) => d.status === "none");

  let overallStatus;
  if (rejectedDocuments.length > 0) {
    overallStatus = "action_required";
  } else if (pendingDocuments.length > 0) {
    overallStatus = "waiting_for_review";
  } else if (untouchedDocuments.length === documents.length) {
    overallStatus = "not_submitted";
  } else {
    overallStatus = "verified";
  }

  return {
    overallStatus,
    documents,
    approvedDocuments: approvedDocuments.map((d) => d.documentType),
    pendingDocuments: pendingDocuments.map((d) => d.documentType),
    rejectedDocuments: rejectedDocuments.map((d) => ({
      documentType: d.documentType,
      label: d.label,
      status: d.status,
      reason: d.reason,
    })),
  };
}

module.exports = {
  DOCUMENT_TYPES,
  buildVerificationStatus,
};
