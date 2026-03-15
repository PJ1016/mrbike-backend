
var router = require('express').Router();
const { verifyUser } = require("../helper/verifyAuth");
const { createS3Upload } = require("../utils/s3Upload");

var { usersignin, verifyOTP, logout, sendOtp, changePassword, getProgress, updateProgress, updateBasicInfo, updateLocationInfo, updateShopDetails, uploadDocuments, updateBankDetails, submitForApproval, checkApprovalStatus, getPendingRegistrations, getDealerDetails, approveDealer, rejectDealer, verifyDocument } = require("../controller/dealerAuth")

const upload = createS3Upload("vendors");


/* POST users listing. */
router.post('/signin', usersignin);
router.post('/sendotp', sendOtp);
router.post('/verifyotp', verifyOTP);
router.post('/logout', logout);
router.post('/changepassword', changePassword);

router.get('/progress', getProgress);
router.put('/progress/:section', updateProgress);
// Form Submission Endpoints
router.post('/basic-info/:id', updateBasicInfo);
router.post('/location-info/:id', updateLocationInfo);
router.post('/shop-details/:id', upload.array('shopImages', 10), updateShopDetails);
router.post('/upload-documents/:id',
  upload.fields([
    { name: 'aadharFront', maxCount: 1 },
    { name: 'aadharBack', maxCount: 1 },
    { name: 'panCard', maxCount: 1 },
    { name: 'shopCertificate', maxCount: 1 },
    { name: 'faceVerificationImage', maxCount: 1 }
  ]),
  uploadDocuments
);
router.post('/bank-details/:id', upload.single('passbookImage'), updateBankDetails);

// Registration Submission & Status
router.post('/submit-registration/:id', submitForApproval);
router.get('/registration-status', checkApprovalStatus);

// Admin Routes (Only accessible by admin)
router.get('/pending-registrations', getPendingRegistrations);
router.get('/pending-registrations/:id', getDealerDetails);
router.put('/approve/:id', approveDealer);
router.put('/reject/:id', rejectDealer);
router.put('/verify-document/:id', verifyDocument);

module.exports = router;