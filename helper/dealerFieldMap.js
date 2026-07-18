const validation = require('./validation');

/**
 * Legacy/alternate payload keys normalized to their canonical schema-facing
 * name before mapping/validation runs. Phase 2B should extend this map
 * rather than hand-rolling new ad-hoc aliases in a controller.
 */
const FIELD_ALIASES = {
  comission: 'commission',
  minimumWalletAmount: 'minWalletAmount',
  minimumWallet: 'minWalletAmount',
  accountHolder: 'accountHolderName',
  ifsc: 'ifscCode',
  upi: 'upiId',
  dateOfBirth: 'dob',
  fullName: 'ownerName',
  pincode: 'shopPincode',
};

const toNumber = (v) => Number.parseFloat(v);
const toBoolean = (v) => v === true || v === 'true';
const toStringArray = (v) => (Array.isArray(v) ? v : [v]).filter((item) => item !== undefined && item !== '');

/**
 * type name -> { validate(value) -> error string | null, coerce(value) -> value to store }
 * validate is optional (some types accept anything, e.g. free-text strings/booleans).
 */
const TYPES = {
  string: {
    coerce: (v) => v,
  },
  email: {
    validate: (v) => (validation.isValidEmail(v) ? null : 'Invalid email address'),
    coerce: (v) => v,
  },
  phone: {
    validate: (v) => (validation.isValidPhone(v) ? null : 'Phone number must be exactly 10 digits'),
    coerce: (v) => v,
  },
  gender: {
    validate: (v) => (validation.isValidGender(v) ? null : 'Gender must be Male, Female or Other'),
    coerce: (v) => v.trim().charAt(0).toUpperCase() + v.trim().slice(1).toLowerCase(),
  },
  date: {
    validate: (v) => (isNaN(new Date(v).getTime()) ? 'Invalid date' : null),
    coerce: (v) => new Date(v),
  },
  latitude: {
    validate: (v) => (validation.isValidLatitude(toNumber(v)) ? null : 'Latitude must be between -90 and 90'),
    coerce: (v) => toNumber(v),
  },
  longitude: {
    validate: (v) => (validation.isValidLongitude(toNumber(v)) ? null : 'Longitude must be between -180 and 180'),
    coerce: (v) => toNumber(v),
  },
  commission: {
    validate: (v) => (validation.isValidCommission(toNumber(v)) ? null : 'Commission must be between 0-100%'),
    coerce: (v) => toNumber(v),
  },
  tax: {
    validate: (v) => (validation.isValidTax(toNumber(v)) ? null : 'Tax must be between 0-18%'),
    coerce: (v) => toNumber(v),
  },
  nonNegativeNumber: {
    validate: (v) => (!isNaN(toNumber(v)) && toNumber(v) >= 0 ? null : 'Must be a non-negative number'),
    coerce: (v) => toNumber(v),
  },
  boolean: {
    coerce: (v) => toBoolean(v),
  },
  ifsc: {
    validate: (v) => (validation.isValidIFSC(v) ? null : 'Invalid IFSC code'),
    coerce: (v) => v.trim().toUpperCase(),
  },
  bankAccountNumber: {
    validate: (v) => (validation.isValidBankAccountNumber(v) ? null : 'Invalid bank account number'),
    coerce: (v) => v,
  },
  pan: {
    validate: (v) => (validation.isValidPAN(v) ? null : 'Invalid PAN card number'),
    coerce: (v) => v.trim().toUpperCase(),
  },
  stringArray: {
    coerce: (v) => toStringArray(v),
  },
};

/**
 * Top-level Vendor schema fields the dealer can self-edit via editDealer.
 * Phase 2B: add new top-level self-editable fields here.
 */
const FIELD_MAP = {
  ownerName: 'string',
  email: 'email',
  personalEmail: 'email',
  phone: 'phone',
  personalPhone: 'phone',
  alternatePhone: 'phone',
  gender: 'gender',
  dob: 'date',
  shopName: 'string',
  shopEmail: 'email',
  shopContact: 'phone',
  shopNumber: 'string',
  locality: 'string',
  storeDescription: 'string',
  holiday: 'string',
  shopOpeningDate: 'date',
  fullAddress: 'string',
  city: 'string',
  state: 'string',
  shopPincode: 'string',
  latitude: 'latitude',
  longitude: 'longitude',
  commission: 'commission',
  tax: 'tax',
  pickupCharges: 'nonNegativeNumber',
  dropCharges: 'nonNegativeNumber',
  providesPickup: 'boolean',
  providesDrop: 'boolean',
  minWalletAmount: 'nonNegativeNumber',
  // pre-existing fields already supported by editDealer, kept for backward compatibility
  aadharCardNo: 'string',
  panCardNo: 'pan',
  gstNumber: 'string',
  // Freeform admin note — not part of the approval state machine, so it's
  // safe to edit here independently of approveDealer/rejectDealer.
  adminNotes: 'string',
  // isActive/isBlocked/registrationStatus intentionally excluded: they're
  // tightly coupled to controller/dealerAuth.js's approveDealer/rejectDealer
  // (which also set approvedAt/status.adminApproved/status.isActive/status.isVerified
  // together) and to routes/dealerRoutes.js's PATCH /:id/status + POST /update_status
  // (which mirror status.isActive alongside isActive). Editing them generically
  // here would desync those companion fields — see Phase 2B reconciliation notes.
};

/**
 * Nested Vendor schema sub-documents. Each sub-field is written via a
 * dotted-path $set (e.g. "bankDetails.ifscCode") — never as a whole-object
 * replacement — so sibling fields not present in the request survive.
 * Phase 2B: add new nested groups/sub-fields here (e.g. documents, liveVerification).
 */
const NESTED_FIELD_MAP = {
  permanentAddress: { address: 'string', city: 'string', state: 'string' },
  presentAddress: { address: 'string', city: 'string', state: 'string' },
  bankDetails: {
    accountHolderName: 'string',
    accountNumber: 'bankAccountNumber',
    bankName: 'string',
    ifscCode: 'ifsc',
    upiId: 'string',
  },
  businessHours: { open: 'string', close: 'string', days: 'stringArray' },
  notifications: { email: 'boolean', sms: 'boolean', app: 'boolean' },
  // liveVerification intentionally has no admin-editable sub-fields here:
  // controller/dealerAuth.js's uploadLiveVerification() replaces the whole
  // liveVerification subdocument (not a dotted $set), so any sibling field
  // added here would be silently wiped the next time the dealer app re-captures
  // a live photo. Extending this safely requires fixing that write first.
};

/**
 * Document file management (Part 1). Each key is the multipart upload field
 * name; the path is where the uploaded file's URL is stored on the Vendor doc.
 */
const DOCUMENT_FILE_PATHS = {
  panCardFront: 'documents.panCardFront',
  aadharFront: 'documents.aadharFront',
  aadharBack: 'documents.aadharBack',
  shopCertificate: 'documents.shopCertificate',
  faceVerificationImage: 'documents.faceVerificationImage',
  passbookImage: 'bankDetails.passbookImage',
};

const DOCUMENT_KEYS = Object.keys(DOCUMENT_FILE_PATHS);

/**
 * Maps each DOCUMENT_KEYS entry to its corresponding key in the existing
 * documentVerification field (models/dealerModel.js), which is the single
 * source of truth for document review status — same field/enum already
 * used by controller/dealerAuth.js's verifyDocument()/uploadDocuments().
 * "aadhar" and "bank" documentVerification keys have no file-upload
 * counterpart here and are left untouched.
 */
const DOCUMENT_VERIFICATION_KEY_MAP = {
  panCardFront: 'pan',
  aadharFront: 'aadharFront',
  aadharBack: 'aadharBack',
  shopCertificate: 'shop',
  faceVerificationImage: 'face',
  passbookImage: 'passbook',
};

/**
 * Fields that must never be written by any dealer-editing endpoint, even if
 * a future edit accidentally adds them to FIELD_MAP/NESTED_FIELD_MAP. Belt
 * and suspenders on top of the allowlist model buildDealerUpdate already uses.
 */
const IMMUTABLE_FIELDS = [
  'dealerId',
  'createdBy',
  'creatorType',
  'creatorModel',
  'otp',
  'otpExpiry',
  'password',
  'wallet',
];

function getAtPath(obj, dottedPath) {
  return dottedPath.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

/**
 * Groups whose sub-fields are also accepted as bare top-level keys in the
 * request body, matching how the original editDealer handler read bank
 * details (req.body.accountHolderName, not req.body.bankDetails.accountHolderName),
 * so existing clients keep working unchanged.
 */
const LEGACY_FLAT_GROUPS = new Set(['bankDetails']);

function normalizeDealerAliases(body) {
  const normalized = { ...body };
  Object.entries(FIELD_ALIASES).forEach(([alias, canonical]) => {
    if (normalized[alias] !== undefined && normalized[canonical] === undefined) {
      normalized[canonical] = normalized[alias];
    }
  });
  return normalized;
}

function readNestedValue(body, groupKey, subKey) {
  if (body[groupKey] && typeof body[groupKey] === 'object' && body[groupKey][subKey] !== undefined) {
    return body[groupKey][subKey];
  }
  const dotted = `${groupKey}.${subKey}`;
  if (body[dotted] !== undefined) {
    return body[dotted];
  }
  if (LEGACY_FLAT_GROUPS.has(groupKey) && body[subKey] !== undefined) {
    return body[subKey];
  }
  return undefined;
}

/**
 * Builds a MongoDB-ready $set payload (dotted paths for nested fields) plus
 * a field->error map, using only the fields actually present in rawBody.
 * Fields not in FIELD_MAP/NESTED_FIELD_MAP are silently ignored — this is
 * what keeps immutable/system fields (dealerId, createdBy, otp, ...) safe
 * without needing an explicit blocklist.
 */
function buildDealerUpdate(rawBody) {
  const body = normalizeDealerAliases(rawBody || {});
  const errors = {};
  const updateData = {};

  Object.entries(FIELD_MAP).forEach(([field, typeName]) => {
    if (body[field] === undefined) return;
    if (body[field] === '') {
      updateData[field] = null;
      return;
    }
    const type = TYPES[typeName];
    const error = type.validate ? type.validate(body[field]) : null;
    if (error) {
      errors[field] = error;
      return;
    }
    updateData[field] = type.coerce(body[field]);
  });

  Object.entries(NESTED_FIELD_MAP).forEach(([groupKey, subFields]) => {
    Object.entries(subFields).forEach(([subKey, typeName]) => {
      const value = readNestedValue(body, groupKey, subKey);
      if (value === undefined) return;
      const path = `${groupKey}.${subKey}`;
      if (value === '') {
        updateData[path] = null;
        return;
      }
      const type = TYPES[typeName];
      const error = type.validate ? type.validate(value) : null;
      if (error) {
        errors[path] = error;
        return;
      }
      updateData[path] = type.coerce(value);
    });
  });

  IMMUTABLE_FIELDS.forEach((field) => {
    delete updateData[field];
  });

  return { updateData, errors };
}

module.exports = {
  FIELD_ALIASES,
  FIELD_MAP,
  NESTED_FIELD_MAP,
  LEGACY_FLAT_GROUPS,
  DOCUMENT_FILE_PATHS,
  DOCUMENT_KEYS,
  DOCUMENT_VERIFICATION_KEY_MAP,
  IMMUTABLE_FIELDS,
  normalizeDealerAliases,
  buildDealerUpdate,
  getAtPath,
};
