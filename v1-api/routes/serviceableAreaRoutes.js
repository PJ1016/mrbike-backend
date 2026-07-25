const express = require("express")
const router = express.Router()
const { requireAdmin } = require("../../middlewares/requireAdmin")
const publicCtrl = require("../controllers/serviceabilityController")
const adminCtrl = require("../controllers/serviceableAreaAdminController")

// Public — user app, run before Home's other data loads. No auth: the
// serviceability gate must resolve before login, matching homeRoutes' other
// public endpoints.
router.get("/serviceability", publicCtrl.checkServiceability)

// Admin CRUD — mirrors the LocationFeaturedCategory admin pattern.
// Static path (/:id/status) declared before /:id to avoid route shadowing.
router.get("/admin/serviceable-areas", requireAdmin, adminCtrl.getList)
router.get("/admin/serviceable-areas/:id", requireAdmin, adminCtrl.getSingle)
router.post("/admin/serviceable-areas", requireAdmin, adminCtrl.create)
router.put("/admin/serviceable-areas/:id", requireAdmin, adminCtrl.update)
router.delete("/admin/serviceable-areas/:id", requireAdmin, adminCtrl.remove)
router.patch("/admin/serviceable-areas/:id/status", requireAdmin, adminCtrl.updateStatus)

module.exports = router
