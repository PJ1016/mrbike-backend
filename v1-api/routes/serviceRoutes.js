const express = require("express")
const router = express.Router()
const controller = require("../controllers/serviceController")

router.get("/services", controller.listByCategory)
router.get("/services/:id/garages", controller.garagesForService)
// Registered after the /garages route so the more specific path always wins.
router.get("/services/:id", controller.getServiceById)

module.exports = router
