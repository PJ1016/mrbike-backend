var express = require("express")
var path = require("path")
const Vendor = require("../models/dealerModel")
const { createS3Upload } = require("../utils/s3Upload")
var {
  editDealer,
  dealerList,
  deleteDealer,
  singledealer,
  dealerWithInRange,
  editDealerStatus,
  GetwalletInfo,
  WalletAdd,
  addAmount,
  tranfer,
  dealerWithInRange2,
  getShopDetails,
  addDealerShopDetails,
  addDealerDocuments,
  getWallet,
  getPendingWallets,
  updateWalletStatus,
  createWithdrawalRequest,
  createDeposit,
  getAllDealersWithDocFalse,
  getAllDealersWithVerifyFalse,
  updateDealerDocStatus,
  updateDealerVerfication,
  setDealerOnline,
  getActiveDealers,
  registerDealerToken,
} = require("../controller/dealer")
const { getDealerServices, saveDealerServices, getDealersByService } = require("../controller/service")
const { processDealer } = require("../controller/dealerController")
const { log } = require("console")
const { getPayouts, getDealerWalletsSummary } = require("../controller/adminFinance")

const router = express.Router()

// Dealer Services
router.get("/services", getDealerServices)
router.post("/services", saveDealerServices)

// Get all dealers offering a specific base service (used by mobile home screen categories)
router.get("/by-service/:baseServiceId", getDealersByService)

// Process dealer files
router.post("/process", processDealer)

const upload = createS3Upload("dealer-documents")

router.post(
  "/addDealer",
  upload.fields([
    { name: "panCardFront", maxCount: 1 },
    { name: "aadharFront", maxCount: 1 },
    { name: "aadharBack", maxCount: 1 },
    { name: "bankPassbook", maxCount: 1 },
    { name: "faceImage", maxCount: 1 },
    { name: "shopImages", maxCount: 5 },
  ]),
  async function addDealer(req, res) {
    try {
      console.log("Incoming payload:", req.body)

      const {
        shopName,
        email,
        phone,
        shopPincode,
        shopNumber,
        locality,
        fullAddress: fullAddressInput,
        city,
        state,
        latitude,
        longitude,
        ownerName,
        alternatePhone,
        accountHolderName,
        ifscCode,
        bankName,
        accountNumber,
        comission: commissionInput,
        tax,
        aadharCardNo,
        panCardNo,
        pickupCharges,
      } = req.body

      // Debug log
      console.log("Commission input:", commissionInput, typeof commissionInput)
      console.log("Tax input:", tax, typeof tax)

      // Validate commission
      const commission = Number.parseFloat(commissionInput)
      if (isNaN(commission) || commission < 0 || commission > 100) {
        return res.status(400).json({
          success: false,
          message: `Commission must be between 0-100%. Received: ${commissionInput}`,
        })
      }

      // Validate tax
      const taxValue = tax ? Number.parseFloat(tax) : 0
      if (tax && (isNaN(taxValue) || taxValue < 0 || taxValue > 18)) {
        return res.status(400).json({
          success: false,
          message: `Tax must be between 0-18%. Received: ${tax}%`,
        })
      }

      // Email format check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        })
      }

      // PAN format: 5 letters, 4 digits, 1 letter
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
      if (!panCardNo || !panRegex.test(panCardNo.trim().toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: "Invalid PAN card number",
        })
      }

      // Aadhar format: 12-digit number
      const aadharRegex = /^\d{12}$/
      if (!aadharCardNo || !aadharRegex.test(aadharCardNo.trim())) {
        return res.status(400).json({
          success: false,
          message: "Invalid Aadhar card number",
        })
      }

      // Check duplicate email/phone
      const existingDealer = await Vendor.findOne({
        $or: [{ email }, { phone }],
      })

      if (existingDealer) {
        const conflictField = existingDealer.email === email ? "Shop Email" : "Shop Contact"
        return res.status(409).json({
          success: false,
          message: `${conflictField} already exists`,
          field: conflictField.toLowerCase().replace(" ", "-"),
        })
      }

      // Required document validation
      const requiredDocs = {
        panCardFront: "PAN Card Front",
        aadharFront: "Aadhar Front",
        aadharBack: "Aadhar Back",
      }

      const missingDocs = Object.entries(requiredDocs)
        .filter(([key]) => !req.files?.[key]?.[0])
        .map(([_, label]) => label)

      if (missingDocs.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Missing required documents",
          missingDocuments: missingDocs,
        })
      }

      const documents = {}
      // Add required documents
      Object.keys(requiredDocs).forEach((key) => {
        documents[key] = req.files[key][0].location
      })

      // Add face image if provided
      if (req.files?.faceImage?.[0]) {
        documents.faceVerificationImage = req.files.faceImage[0].location
      }

      // Parse DOB
      let parsedDob = null;
      if (ownerName && req.body.dob) {
        // Simple attempt to parse common formats
        const dobStr = req.body.dob;
        const d = new Date(dobStr);
        if (!isNaN(d.getTime())) {
          parsedDob = d;
        }
      }

      const dealerData = {
        shopName,
        email,
        phone,
        shopPincode,
        shopNumber,
        locality,
        fullAddress: [shopNumber, locality, city, state ? `${state} - ${shopPincode}` : shopPincode].filter(Boolean).join(", ") || fullAddressInput,
        city,
        state,
        latitude: Number.parseFloat(latitude),
        longitude: Number.parseFloat(longitude),
        ownerName,
        dob: parsedDob,
        alternatePhone,
        bankDetails: {
          accountHolderName,
          ifscCode,
          bankName,
          accountNumber,
          passbookImage: req.files?.bankPassbook?.[0]?.location || null,
        },
        aadharCardNo: aadharCardNo.trim(),
        panCardNo: panCardNo.trim().toUpperCase(),
        commission,
        tax: taxValue,
        pickupCharges: pickupCharges ? Number.parseFloat(pickupCharges) : 0,
        documents,
        shopImages: req.files?.shopImages?.map((file) => file.location) || [],
        isVerify: false,
        isProfile: true,
        isDoc: true,
        isActive: true,
      }

      const newDealer = await Vendor.create(dealerData)

      return res.status(201).json({
        success: true,
        message: "Dealer registered successfully",
        data: {
          id: newDealer._id,
          shopName: newDealer.shopName,
          email: newDealer.email,
        },
      })
    } catch (error) {
      console.error("Registration error:", error)

      // Cleanup uploaded files
      if (req.files) {
        Object.values(req.files)
          .flat()
          .forEach((file) => {
            try {
              if (file?.filename) {
                fs.unlinkSync(path.join(uploadDir, file.filename))
              }
            } catch (err) {
              console.error("File cleanup error:", err)
            }
          })
      }

      return res.status(500).json({
        success: false,
        message: "Registration failed due to server error",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      })
    }
  },
)

// By Prashant
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params
    const { isActive, isBlocked, blockedReason } = req.body

    if (isActive === undefined && isBlocked === undefined) {
      return res.status(400).json({
        success: false,
        message: "At least one of isActive or isBlocked must be provided",
      })
    }
    if (isActive !== undefined && typeof isActive !== "boolean") {
      return res.status(400).json({ success: false, message: "isActive must be a boolean value" })
    }
    if (isBlocked !== undefined && typeof isBlocked !== "boolean") {
      return res.status(400).json({ success: false, message: "isBlocked must be a boolean value" })
    }

    const updateData = {}
    if (isActive !== undefined) {
      updateData.isActive = isActive
      updateData["status.isActive"] = isActive
    }
    if (isBlocked !== undefined) {
      updateData.isBlocked = isBlocked
    }
    if (blockedReason !== undefined) {
      updateData.blockedReason = blockedReason
    }

    const dealerBefore = await Vendor.findById(id)
    if (!dealerBefore) {
      return res.status(404).json({ success: false, message: "Dealer not found" })
    }
    console.log("Dealer before update", dealerBefore)
    console.log("Update object", updateData)

    const dealer = await Vendor.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true })
    console.log("Dealer after update", dealer)

    res.status(200).json({
      success: true,
      message: isActive !== undefined
        ? `Dealer ${dealer.isActive ? "activated" : "deactivated"} successfully`
        : `Dealer ${dealer.isBlocked ? "blocked" : "unblocked"} successfully`,
      data: {
        _id: dealer._id,
        isActive: dealer.isActive,
        status: {
          isActive: dealer.status?.isActive,
          adminApproved: dealer.status?.adminApproved,
        },
        isBlocked: dealer.isBlocked,
        blockedReason: dealer.blockedReason,
        registrationStatus: dealer.registrationStatus,
      },
    })
  } catch (error) {
    console.error("Error updating dealer status:", error)
    res.status(500).json({
      success: false,
      message: "Server error while updating dealer status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
})

router.get("/view/:id", async (req, res) => {
  try {
    const dealer = await Vendor.findById(req.params.id)
    if (!dealer) {
      return res.status(404).json({ error: "Dealer not found" })
    }
    res.json(dealer)
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

router.put(
  "/editDealer",
  upload.fields([
    { name: "panCardFront", maxCount: 1 },
    { name: "aadharFront", maxCount: 1 },
    { name: "aadharBack", maxCount: 1 },
    { name: "shopImages", maxCount: 5 },
  ]),
  async function editDealer(req, res) {
    try {
      const dealerId = req.body.id
      console.log("Request Body:", req.body)
      console.log("Request Files:", req.files)

      // Find existing dealer
      const existingDealer = await Vendor.findById(dealerId)
      if (!existingDealer) {
        return res.status(404).json({
          success: false,
          message: "Dealer not found",
        })
      }

      // Validate inputs
      const errors = {}

      // Commission validation
      if (req.body.comission !== undefined) {
        const commission = Number.parseFloat(req.body.comission)
        if (isNaN(commission) || commission < 0 || commission > 100) {
          errors.comission = "Commission must be between 0-100%"
        }
      }

      // PAN validation
      if (req.body.panCardNo !== undefined && req.body.panCardNo !== "") {
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(req.body.panCardNo.trim().toUpperCase())) {
          errors.panCardNo = "Invalid PAN card number"
        }
      }

      if (Object.keys(errors).length > 0) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors,
        })
      }

      // Prepare update data
      const updateData = {}
      const fields = [
        "shopName",
        "email",
        "phone",
        "shopPincode",
        "shopNumber",
        "locality",
        "fullAddress",
        "city",
        "state",
        "latitude",
        "longitude",
        "ownerName",
        "alternatePhone",
        "aadharCardNo",
        "panCardNo",
        "gstNumber",
      ]

      fields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field] === "" ? null : req.body[field]
        }
      })

      // Auto-sync fullAddress if address components are updated
      const addressComponentsChanged = ["shopNumber", "locality", "city", "state", "shopPincode"].some(
        (field) => req.body[field] !== undefined
      )
      
      if (addressComponentsChanged) {
        const addr = {
          shopNumber: req.body.shopNumber !== undefined ? req.body.shopNumber : existingDealer.shopNumber,
          locality: req.body.locality !== undefined ? req.body.locality : existingDealer.locality,
          city: req.body.city !== undefined ? req.body.city : existingDealer.city,
          state: req.body.state !== undefined ? req.body.state : existingDealer.state,
          shopPincode: req.body.shopPincode !== undefined ? req.body.shopPincode : existingDealer.shopPincode,
        }
        
        updateData.fullAddress = [
          addr.shopNumber,
          addr.locality,
          addr.city,
          addr.state ? `${addr.state} - ${addr.shopPincode}` : addr.shopPincode
        ].filter(Boolean).join(", ")
      }

      // Handle numeric fields
      if (req.body.comission !== undefined) {
        updateData.commission = Number.parseFloat(req.body.comission)
      }
      if (req.body.tax !== undefined) {
        updateData.tax = req.body.tax === "" ? null : Number.parseFloat(req.body.tax)
      }
      if (req.body.pickupCharges !== undefined) {
        updateData.pickupCharges = req.body.pickupCharges === "" ? 0 : Number.parseFloat(req.body.pickupCharges)
      }
      if (req.body.minWalletAmount !== undefined) {
        updateData.minWalletAmount = req.body.minWalletAmount === "" ? 0 : Number.parseFloat(req.body.minWalletAmount)
      }

      // service capability fields
      if (req.body.providesPickup !== undefined) {
        updateData.providesPickup = req.body.providesPickup === "true" || req.body.providesPickup === true
      }
      if (req.body.providesDrop !== undefined) {
        updateData.providesDrop = req.body.providesDrop === "true" || req.body.providesDrop === true
      }
      if (req.body.dropCharges !== undefined) {
        updateData.dropCharges = req.body.dropCharges === "" ? 0 : Number.parseFloat(req.body.dropCharges)
      }

      // Handle bank details
      if (
        req.body.accountHolderName !== undefined ||
        req.body.ifscCode !== undefined ||
        req.body.bankName !== undefined ||
        req.body.accountNumber !== undefined
      ) {
        updateData.bankDetails = {
          accountHolderName: req.body.accountHolderName || existingDealer.bankDetails.accountHolderName,
          ifscCode: req.body.ifscCode || existingDealer.bankDetails.ifscCode,
          bankName: req.body.bankName || existingDealer.bankDetails.bankName,
          accountNumber: req.body.accountNumber || existingDealer.bankDetails.accountNumber,
        }
      }

      // Handle document uploads
      if (req.files) {
        updateData.documents = { ...existingDealer.documents }

        const documentFields = [
          { field: "panCardFront", name: "panCardFront" },
          { field: "aadharFront", name: "aadharFront" },
          { field: "aadharBack", name: "aadharBack" },
        ]

        documentFields.forEach(({ field, name }) => {
          if (req.files[field]) {
            // Delete old file if exists
            if (existingDealer.documents[name]) {
              try {
                fs.unlinkSync(path.join(uploadDir, existingDealer.documents[name]))
              } catch (err) {
                console.error(`Error deleting old ${name}:`, err)
              }
            }
            // Add new file
            updateData.documents[name] = req.files[field][0].location
          }
        })
      }

      // Handle shop images
      if (req.body.existingShopImages !== undefined || req.files?.shopImages) {
        const imagesToKeep = Array.isArray(req.body.existingShopImages) ? req.body.existingShopImages : req.body.existingShopImages ? [req.body.existingShopImages] : [];
        const newImages = req.files?.shopImages ? req.files.shopImages.map((file) => file.location) : [];

        const keptImages = existingDealer.shopImages.filter(
          (img) => imagesToKeep.some((keptImg) => keptImg.includes(img)),
        )

        if (keptImages.length + newImages.length > 5) {
          return res.status(400).json({
            success: false,
            message: "Maximum 5 shop images allowed",
          })
        }

        updateData.shopImages = [...keptImages, ...newImages]

        // Delete removed images
        existingDealer.shopImages.forEach((img) => {
          if (!imagesToKeep.some((keptImg) => keptImg.includes(img))) {
            try {
              fs.unlinkSync(path.join(uploadDir, img))
            } catch (err) {
              console.error("Error deleting shop image:", err)
            }
          }
        })
      }

      // Update the dealer
      const updatedDealer = await Vendor.findByIdAndUpdate(
        dealerId,
        { $set: updateData },
        { new: true, runValidators: true },
      )

      return res.status(200).json({
        success: true,
        message: "Dealer updated successfully",
        data: updatedDealer,
      })
    } catch (error) {
      console.error("Edit dealer error:", error)

      // Cleanup uploaded files if error occurred
      if (req.files) {
        Object.values(req.files)
          .flat()
          .forEach((file) => {
            try {
              if (file?.filename) {
                fs.unlinkSync(path.join(uploadDir, file.filename))
              }
            } catch (err) {
              console.error("File cleanup error:", err)
            }
          })
      }

      return res.status(500).json({
        success: false,
        message: error.name === "ValidationError" ? "Validation failed" : "Update failed due to server error",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      })
    }
  },
)

router.get("/dealerList", dealerList)
router.get("/dealerWithInRange", dealerWithInRange)
router.get("/dealerWithInRange2", dealerWithInRange2)
router.get("/dealer/:id", singledealer)
router.get("/dealerWallet/:id", GetwalletInfo)
router.get("/dealerWallet", getWallet)
router.get("/dealersWithDocFalse", getAllDealersWithDocFalse)
router.get("/dealersWithVerifyFalse", getAllDealersWithVerifyFalse)

router.delete("/deleteDealer", deleteDealer)
router.post("/update_status", editDealerStatus)

router.post("/processTransaction/:id", WalletAdd)

//  Payout of cashfree ---- NOT IN Use
router.post("/AddAmout/:id", addAmount)
router.post("/prepare-transfer", tranfer)
router.get("/getShopDetails/:id", getShopDetails)

router.post("/add-shop-details", upload.fields([{ name: "shopImages", maxCount: 5 }]), addDealerShopDetails)

router.post(
  "/add-dealer-documents",
  upload.fields([
    { name: "adharCardFront", maxCount: 1 },
    { name: "adharCardBack", maxCount: 1 },
    { name: "panCardFront", maxCount: 1 },
    { name: "panCardBack", maxCount: 1 },
  ]),
  addDealerDocuments,
)

// ── Finance admin routes (must precede param-based routes) ───────────────────
// GET /bikedoctor/dealer/payouts?status=ALL|PENDING|IN_PROGRESS|APPROVED|REJECTED
router.get("/payouts", getPayouts)
// GET /bikedoctor/dealer/wallets/summary
router.get("/wallets/summary", getDealerWalletsSummary)

// ── Existing wallet routes (preserved for backward compatibility) ─────────────
router.get("/pending", getPendingWallets)
router.put("/updatepending/:wallet_id", updateWalletStatus)
router.post("/withdrawal", createWithdrawalRequest)
router.post("/deposit", createDeposit)
router.put("/updateDocStatus", updateDealerDocStatus)
router.put("/updateVerification", updateDealerVerfication)

router.post("/vendor/:dealerId/online", setDealerOnline)

router.get("/vendor/active", getActiveDealers)

router.post("/register-token", registerDealerToken)

module.exports = router
