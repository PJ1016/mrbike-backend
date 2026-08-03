const express = require("express")
const router = express.Router()
const { requireAdmin } = require("../middlewares/requireAdmin")
const { verifyDealerToken, requireOwnDealer, requireOwnDealerBody } = require("../middlewares/dealerAuth")
const {
  addAdditionalService,
  getAllAdditionalServices,
  getAdditionalServiceById,
  updateAdditionalService,
  deleteAdditionalService,
  getAdditionalServicesByDealerId,
  saveSelectedServices,
} = require("../controller/additionalServiceController")

/* =====================================================
   ADMIN ROUTES
===================================================== */
// Admin: Create new additional service
router.post("/admin/additional-services", requireAdmin, addAdditionalService)

// Admin: Get all additional services
router.get("/admin/additional-services", requireAdmin, getAllAdditionalServices)

// Admin: Get single additional service by ID
router.get("/admin/additional-services/:id", requireAdmin, getAdditionalServiceById)

// Admin: Update additional service
router.put("/admin/additional-services/:id", requireAdmin, updateAdditionalService)

// Admin: Delete additional service
router.delete("/admin/additional-services/:id", requireAdmin, deleteAdditionalService)

/* =====================================================
   DEALER ROUTES
===================================================== */
// Dealer: Get services assigned to dealer
router.get("/dealer/additional-services/:dealerId", verifyDealerToken, requireOwnDealer("dealerId"), getAdditionalServicesByDealerId)

/* =====================================================
   LEGACY ROUTES (kept for backward compatibility)
===================================================== */
router.post("/add-service", requireAdmin, addAdditionalService)
router.get("/all-additional-services", getAllAdditionalServices)
router.get("/single-additional-service/:id", getAdditionalServiceById)
router.put("/updated-additional-service/:id", requireAdmin, updateAdditionalService)
router.delete("/delete-additional-service/:id", requireAdmin, deleteAdditionalService)
router.get("/:dealerId", getAdditionalServicesByDealerId)
router.post("/select-services", verifyDealerToken, requireOwnDealerBody("dealer_id"), saveSelectedServices)

module.exports = router
