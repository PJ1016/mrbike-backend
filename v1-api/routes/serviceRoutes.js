const express = require("express")
const router = express.Router()
const controller = require("../controllers/serviceController")
const { attachCustomerIfPresent } = require("../../middlewares/optionalCustomer")

// These stay public — the app renders them before sign-in. attachCustomerIfPresent
// only identifies a rider when a valid customer token happens to be present, so
// discovery can be evaluated against ALL their saved bikes instead of whichever
// single bikeId the client sent. It never rejects a request. Attached per route
// rather than with router.use(), because every v1 router is mounted at "/" and a
// router-level middleware would run for unrelated v1 paths too.
router.get("/services", attachCustomerIfPresent, controller.listByCategory)
router.get("/services/:id/garages", attachCustomerIfPresent, controller.garagesForService)
// Registered after the /garages route so the more specific path always wins.
router.get("/services/:id", attachCustomerIfPresent, controller.getServiceById)

module.exports = router
