const express = require("express")
const router = express.Router()

router.use("/", require("./serviceCategoryRoutes"))
router.use("/", require("./serviceRoutes"))
router.use("/", require("./homeRoutes"))
router.use("/", require("./bikeCompatibilityRoutes"))

module.exports = router
