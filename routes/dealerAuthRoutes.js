
var router = require('express').Router();
const { createS3Upload } = require("../utils/s3Upload");
const { verifyDealerToken, verifyDealerTokenForLogout, requireOwnDealer } = require("../middlewares/dealerAuth");
const { requireAdmin } = require("../middlewares/requireAdmin");

var { usersignin, verifyOTP, logout, sendOtp, changePassword, getProgress, updateProgress, updateBasicInfo, updateLocationInfo, updateShopDetails, uploadDocuments, uploadLiveVerification, updateBankDetails, submitForApproval, checkApprovalStatus, getVerificationStatus, submitReVerification, getPendingRegistrations, getDealerDetails, approveDealer, rejectDealer, verifyDocument } = require("../controller/dealerAuth")

const upload = createS3Upload("vendors");


/* POST users listing. */
router.post('/signin', usersignin);
router.post('/sendotp', sendOtp);
router.post('/verifyotp', verifyOTP);
// Logout uses the permissive logout-only guard so an expired token or a
// blocked account can still force the dealer offline and drop their device
// registration server-side — see verifyDealerTokenForLogout.
router.post('/logout', verifyDealerTokenForLogout, logout);
router.post('/changepassword', verifyDealerToken, changePassword);

// getProgress verifies its own Bearer token internally — left as-is.
router.get('/progress', getProgress);
router.put('/progress/:section', verifyDealerToken, updateProgress);
// Form Submission Endpoints — dealer can only edit their own registration record
router.post('/basic-info/:id', verifyDealerToken, requireOwnDealer('id'), updateBasicInfo);
router.post('/location-info/:id', verifyDealerToken, requireOwnDealer('id'), updateLocationInfo);
router.post('/shop-details/:id', verifyDealerToken, requireOwnDealer('id'), upload.any(), updateShopDetails);
router.post('/upload-documents/:id',
  verifyDealerToken, requireOwnDealer('id'),
  upload.fields([
    { name: 'aadharFront', maxCount: 1 },
    { name: 'aadharBack', maxCount: 1 },
    { name: 'panCard', maxCount: 1 },
    { name: 'shopCertificate', maxCount: 1 },
    { name: 'faceVerificationImage', maxCount: 1 }
  ]),
  uploadDocuments
);
router.post('/live-verification/:id', verifyDealerToken, requireOwnDealer('id'), upload.single('shopLivePhoto'), uploadLiveVerification);
router.post('/bank-details/:id', verifyDealerToken, requireOwnDealer('id'), upload.single('passbookImage'), updateBankDetails);

// Registration Submission & Status
router.post('/submit-registration/:id', verifyDealerToken, requireOwnDealer('id'), submitForApproval);
router.get('/registration-status', verifyDealerToken, checkApprovalStatus);

// Document Re-Verification (post-onboarding document corrections). Re-upload
// of a single rejected/requested document reuses the existing
// /upload-documents/:id and /bank-details/:id endpoints above — both already
// update only the document(s) actually uploaded, so no separate endpoint is
// needed for that step.
router.get('/verification-status', verifyDealerToken, getVerificationStatus);
router.post('/submit-reverification/:id', verifyDealerToken, requireOwnDealer('id'), submitReVerification);

// Admin Routes (Only accessible by admin)
router.get('/pending-registrations', requireAdmin, getPendingRegistrations);
router.get('/pending-registrations/:id', requireAdmin, getDealerDetails);
router.put('/approve/:id', requireAdmin, approveDealer);
router.put('/reject/:id', requireAdmin, rejectDealer);
router.put('/verify-document/:id', requireAdmin, verifyDocument);

module.exports = router;
