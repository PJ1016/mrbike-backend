const express = require("express")
const router = express.Router()
const { requireAdmin } = require("../../middlewares/requireAdmin")
const controller = require("../controllers/serviceCategoryController")

// Public — user app
router.get("/service-categories", controller.listActive)

// Admin
router.get("/admin/service-categories", requireAdmin, controller.listAll)
router.post("/admin/service-categories", requireAdmin, controller.create)
router.patch("/admin/service-categories/reorder", requireAdmin, controller.reorder)
router.get("/admin/service-categories/:id", requireAdmin, controller.getById)
router.put("/admin/service-categories/:id", requireAdmin, controller.update)
router.patch("/admin/service-categories/:id/status", requireAdmin, controller.toggleStatus)
router.delete("/admin/service-categories/:id", requireAdmin, controller.remove)

module.exports = router
