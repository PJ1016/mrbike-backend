const express = require("express")
const router = express.Router()
const { createS3Upload } = require("../utils/s3Upload")
const { verifyToken } = require("../helper/verifyAuth")
const { requireAdmin } = require("../middlewares/requireAdmin")
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
  requireAdmin,
  baseAdditionalServiceUpload.single("image"),
  createBaseAdditionalService
)
router.get("/", listBaseAdditionalServices)
router.get("/:id", getBaseAdditionalServiceById)
router.put(
  "/:id",
  requireAdmin,
  baseAdditionalServiceUpload.single("image"),
  updateBaseAdditionalService
)
router.delete("/:id", requireAdmin, deleteBaseAdditionalService)

module.exports = router
