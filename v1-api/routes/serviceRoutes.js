const express = require("express")
const router = express.Router()
const controller = require("../controllers/serviceController")

router.get("/services", controller.listByCategory)
router.get("/services/:id/garages", controller.garagesForService)

module.exports = router
