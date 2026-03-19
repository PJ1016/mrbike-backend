const express = require("express")
const router = express.Router()
const { createS3Upload } = require("../utils/s3Upload")
const { verifyToken } = require("../helper/verifyAuth")
const {
  createBaseAdditionalService,
  listBaseAdditionalServices,
  getBaseAdditionalServiceById,
  updateBaseAdditionalService,
  deleteBaseAdditionalService,
} = require("../controller/baseAdditionalServiceController")

const baseAdditionalServiceUpload = createS3Upload("base-additional-services")

// Admin only routes — write operations require a valid admin token
router.post(
  "/",
  verifyToken,
  baseAdditionalServiceUpload.single("image"),
  createBaseAdditionalService
)
router.get("/", listBaseAdditionalServices)
router.get("/:id", getBaseAdditionalServiceById)
router.put(
  "/:id",
  verifyToken,
  baseAdditionalServiceUpload.single("image"),
  updateBaseAdditionalService
)
router.delete("/:id", verifyToken, deleteBaseAdditionalService)

module.exports = router
