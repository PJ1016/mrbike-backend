var express = require("express")
var multer = require("multer")
const path = require("path")
var fs = require("fs-extra")
const { verifyToken } = require("../helper/verifyAuth")
const { requireAdmin } = require("../middlewares/requireAdmin")
var {
  addProfile,
  customerlist,
  deletecustomer,
  editcustomer,
  getcustomer,
  getCustomerById,
  getReferredCustomers,
  changeImage,
  updateUserBike,
  getMyBikes,
  deleteMyBike,
  addUserBike,
  getcustomersData,
  getMyReferralCode,
  validateReferralCode,
  getReferralSummary,
  getReferralTransactions,
} = require("../controller/customers")
const { createS3Upload } = require("../utils/s3Upload")
const router = express.Router()

const s3Upload = createS3Upload("customer-profiles")

// set storage
const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    const uploadDir = path.join(process.cwd(), "uploads/userprofile")
    fs.mkdirsSync(uploadDir)
    callback(null, uploadDir)
  },
  filename: (req, file, callback) => {
    const ext = file.originalname.substring(file.originalname.lastIndexOf("."))
    callback(null, file.fieldname + "-" + Date.now() + ext)
  },
})

const upload = multer({
  storage: storage,
})

/* POST users listing. */
router.post(
  "/addProfile",
  verifyToken,
  s3Upload.single("images"),
  addProfile,
)
router.get("/getMyBikes", verifyToken, getMyBikes)
router.post("/deleteMyBike/:bike_id", verifyToken, deleteMyBike)
router.post("/addUserBike", verifyToken, addUserBike)

router.put("/user-bike/:id", verifyToken, updateUserBike)
router.get("/customerlist", customerlist)
// router.get('/customer',getcustomer);
router.get("/customer/:user_id", getcustomer)
router.get("/customersdata/:user_id", getcustomersData)
router.get("/view/:id", requireAdmin, getCustomerById)
router.get("/:id/referrals", requireAdmin, getReferredCustomers)
router.delete("/deletecustomer", deletecustomer)
router.put("/editcustomer/:id", verifyToken, editcustomer)
router.put("/editimage", verifyToken, s3Upload.single("images"), changeImage)
router.get("/getMyReferralCode", verifyToken, getMyReferralCode)
router.post("/validateReferralCode", verifyToken, validateReferralCode)
router.get("/getReferralSummary", verifyToken, getReferralSummary)
router.get("/getReferralTransactions", verifyToken, getReferralTransactions)

//Uploading Single file
router.post("/uploadfile", upload.single("myFile"), (req, res, next) => {
  const file = req.file
  if (!file) {
    const error = new Error("Please upload a file")
    error.httpStatusCode = 400
    return next(error)
  } else {
    console.log("file received")
    return res.send({
      success: true,
      data: file,
    })
  }
})

//Uploading multiple files
router.post("/uploadmultiple", upload.array("myFiles", 12), (req, res, next) => {
  const files = req.files
  if (!files) {
    const error = new Error("Please choose files")
    error.httpStatusCode = 400
    return next(error)
  } else {
    console.log("file received")
    return res.send({
      success: true,
      data: files,
    })
  }
})

module.exports = router
