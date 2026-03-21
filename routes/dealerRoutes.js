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
  getAllDealersWithDocFalse,
  getAllDealersWithVerifyFalse,
  updateDealerDocStatus,
  updateDealerVerfication,
  setDealerOnline,
  getActiveDealers,
} = require("../controller/dealer")
const { getDealerServices, saveDealerServices } = require("../controller/service")
const { log } = require("console")

const router = express.Router()

// Dealer Services
router.get("/services", getDealerServices)
router.post("/services", saveDealerServices)

const upload = createS3Upload("dealer-documents")

router.post(
  "/addDealer",
  upload.fields([
    { name: "panCardFront", maxCount: 1 },
    { name: "aadharFront", maxCount: 1 },
    { name: "aadharBack", maxCount: 1 },
    { name: "shopImages", maxCount: 5 },
  ]),
  async function addDealer(req, res) {
    try {
      console.log("Incoming payload:", req.body)

      const {
        shopName,
        email,
        phone,
        password,
        shopPincode,
        fullAddress,
        city,
        state,
        latitude,
        longitude,
        ownerName,
        personalEmail,
        personalPhone,
        alternatePhone,
        permanentAddress,
        permanentState,
        permanentCity,
        presentAddress,
        presentState,
        presentCity,
        accountHolderName,
        ifscCode,
        bankName,
        accountNumber,
        comission: commissionInput,
        tax,
        aadharCardNo,
        panCardNo,
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
      Object.keys(requiredDocs).forEach((key) => {
        documents[key] = req.files[key][0].location
      })

      const dealerData = {
        shopName,
        email,
        phone,
        password,
        shopPincode,
        fullAddress,
        city,
        state,
        latitude: Number.parseFloat(latitude),
        longitude: Number.parseFloat(longitude),
        ownerName,
        personalEmail: personalEmail.trim().toLowerCase(),
        personalPhone,
        alternatePhone,
        permanentAddress: {
          address: permanentAddress,
          state: permanentState,
          city: permanentCity,
        },
        presentAddress: {
          address: presentAddress,
          state: presentState,
          city: presentCity,
        },
        bankDetails: {
          accountHolderName,
          ifscCode,
          bankName,
          accountNumber,
        },
        aadharCardNo: aadharCardNo.trim(),
        panCardNo: panCardNo.trim().toUpperCase(),
        commission,
        tax: taxValue,
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
    const { isActive } = req.body

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean value",
      })
    }

    const dealer = await Vendor.findByIdAndUpdate(id, { isActive }, { new: true, runValidators: true })

    if (!dealer) {
      return res.status(404).json({
        success: false,
        message: "Dealer not found",
      })
    }

    res.status(200).json({
      success: true,
      message: `Dealer status updated to ${dealer.isActive ? "Active" : "Inactive"}`,
      data: {
        id: dealer._id,
        isActive: dealer.isActive,
        shopName: dealer.shopName,
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
        "fullAddress",
        "city",
        "state",
        "latitude",
        "longitude",
        "ownerName",
        "personalEmail",
        "personalPhone",
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

      // Handle numeric fields
      if (req.body.comission !== undefined) {
        updateData.commission = Number.parseFloat(req.body.comission)
      }
      if (req.body.tax !== undefined) {
        updateData.tax = req.body.tax === "" ? null : Number.parseFloat(req.body.tax)
      }

      // Handle addresses
      if (
        req.body.permanentAddress !== undefined ||
        req.body.permanentState !== undefined ||
        req.body.permanentCity !== undefined
      ) {
        updateData.permanentAddress = {
          address: req.body.permanentAddress || existingDealer.permanentAddress.address,
          state: req.body.permanentState || existingDealer.permanentAddress.state,
          city: req.body.permanentCity || existingDealer.permanentAddress.city,
        }
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

router.get("/pending", getPendingWallets)
router.put("/updatepending", updateWalletStatus)
router.put("/updateDocStatus", updateDealerDocStatus)
router.put("/updateVerification", updateDealerVerfication)

router.post("/vendor/:dealerId/online", setDealerOnline)

router.get("/vendor/active", getActiveDealers)

module.exports = router
