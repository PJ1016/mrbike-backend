const express = require("express")
const router = express.Router()
const { requireAdmin } = require("../../middlewares/requireAdmin")
const controller = require("../controllers/bikeCompatibilityController")

router.get("/admin/bike-compatibility/by-service/:serviceId", requireAdmin, controller.byService)
router.get("/admin/bike-compatibility/by-brand/:companyId", requireAdmin, controller.byBrand)

module.exports = router
