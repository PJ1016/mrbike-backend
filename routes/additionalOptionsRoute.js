var express = require("express")
var multer = require("multer")
var fs = require("fs")
var path = require("path")

var {
  addservice,
  servicelist,
  updateService,
  deleteService,
  singleService,
  getServicesByDealer,
} = require("../controller/additionalOptionscontroller")

const router = express.Router()
const { requireAdmin } = require("../middlewares/requireAdmin")

// Define the folder path
const uploadDir = path.join(__dirname, "../image")

// Ensure the folder exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Set up Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDir)
  },
  filename: (req, file, callback) => {
    const ext = path.extname(file.originalname)
    const uniqueName = `${file.fieldname}-${Date.now()}${ext}`
    callback(null, uniqueName)
  },
})

// Configure Multer with size limit (20MB)
const upload = multer({
  storage: storage,
})

// Define Routes
router.post("/addservice", requireAdmin, upload.single("images"), addservice)
router.get("/servicelist", servicelist)
router.put("/updateservice", requireAdmin, upload.fields([{ name: "service_image", maxCount: 1 }]), updateService)
router.delete("/deleteService", requireAdmin, deleteService)
router.get("/service/:id", singleService)

router.get("/dealer/:dealer_id", getServicesByDealer)

module.exports = router
