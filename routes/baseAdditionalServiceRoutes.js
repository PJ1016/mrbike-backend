const express = require("express")
const router = express.Router()
const { createS3Upload } = require("../utils/s3Upload")
const {
  createBaseAdditionalService,
  listBaseAdditionalServices,
  getBaseAdditionalServiceById,
  updateBaseAdditionalService,
  deleteBaseAdditionalService,
} = require("../controller/baseAdditionalServiceController")

const baseAdditionalServiceUpload = createS3Upload("base-additional-services")

// Admin only routes
router.post(
  "/",
  baseAdditionalServiceUpload.single("image"),
  createBaseAdditionalService
)
router.get("/", listBaseAdditionalServices)
router.get("/:id", getBaseAdditionalServiceById)
router.put(
  "/:id",
  baseAdditionalServiceUpload.single("image"),
  updateBaseAdditionalService
)
router.delete("/:id", deleteBaseAdditionalService)

module.exports = router
