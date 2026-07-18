// Canonical dealer status system. This is the single source of truth for
// the 7 supported dealer lifecycle states, and the derivation logic that
// keeps `dealerStatus` in sync with the legacy fields (registrationStatus,
// status.*, isActive, isBlocked, isDoc) that every existing dealer API
// already reads/writes.

const DEALER_STATUSES = [
  "Pending",
  "Pending Documents",
  "Approved",
  "Active",
  "Inactive",
  "Blocked",
  "Rejected",
];

// Computes the canonical status from a dealer's legacy fields. Used to keep
// `dealerStatus` in sync without having to rewrite every existing write path.
function deriveDealerStatus(dealer) {
  if (dealer.isBlocked) return "Blocked";

  if (dealer.registrationStatus === "Rejected") return "Rejected";

  const adminApproved = dealer.status?.adminApproved ?? false;
  const isActive = dealer.status?.isActive ?? dealer.isActive ?? false;

  if (dealer.registrationStatus === "Approved" || adminApproved) {
    return isActive ? "Active" : "Inactive";
  }

  if (dealer.isDoc) return "Pending Documents";

  return "Pending";
}

// Reads the canonical status off a dealer document, falling back to
// deriveDealerStatus for records written before this field existed.
function getDealerStatus(dealer) {
  if (dealer.dealerStatus && DEALER_STATUSES.includes(dealer.dealerStatus)) {
    return dealer.dealerStatus;
  }
  return deriveDealerStatus(dealer);
}

// Merges a flat/dotted findOneAndUpdate `$set` payload onto a dealer
// document's current status-relevant fields, so dealerStatus can be
// re-derived before the write lands.
function mergeForStatus(currentDoc, flatUpdate) {
  const merged = {
    isBlocked: currentDoc.isBlocked,
    isActive: currentDoc.isActive,
    isDoc: currentDoc.isDoc,
    registrationStatus: currentDoc.registrationStatus,
    status: {
      adminApproved: currentDoc.status?.adminApproved,
      isActive: currentDoc.status?.isActive,
      isVerified: currentDoc.status?.isVerified,
    },
  };

  Object.entries(flatUpdate || {}).forEach(([key, value]) => {
    if (key === "status.isActive") merged.status.isActive = value;
    else if (key === "status.adminApproved") merged.status.adminApproved = value;
    else if (key === "status.isVerified") merged.status.isVerified = value;
    else if (key === "status" && value && typeof value === "object") {
      merged.status = { ...merged.status, ...value };
    } else if (key in merged) {
      merged[key] = value;
    }
  });

  return merged;
}

module.exports = {
  DEALER_STATUSES,
  deriveDealerStatus,
  getDealerStatus,
  mergeForStatus,
};
