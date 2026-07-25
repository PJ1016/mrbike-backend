const express = require("express")
const router = express.Router()
const { requireAdmin } = require("../../middlewares/requireAdmin")
const controller = require("../controllers/homeController")

// Public — user app
router.get("/home/quick-services", controller.quickServices)
router.get("/home/recommended", controller.recommended)
router.get("/home/most-booked", controller.mostBooked)
router.get("/home/top-garages", controller.topGarages)

// Admin — read-only sanity-check views, same real data, city-scoped instead of live GPS.
router.get("/admin/home/most-booked", requireAdmin, controller.mostBooked)
router.get("/admin/home/top-garages", requireAdmin, controller.topGarages)

module.exports = router
