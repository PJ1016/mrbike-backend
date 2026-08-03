var express = require("express")
var path = require("path")
const { createS3Upload } = require("../utils/s3Upload")
const { requireAdmin } = require("../middlewares/requireAdmin")
const { verifyDealerToken } = require("../middlewares/dealerAuth")
const { requireCustomer, requireOwnCustomerBody } = require("../middlewares/customerAuth")

var {
  servicelist,
  updateService,
  deleteService,
  singleService,
  getServicesByDealer,
  addAdminService,
  listAdminServices,
  getServiceById,
  updateServiceById,
  addAdditionalService,
  additionalservicelist,
  deleteAdditionaalService,
  getAdditionalServiceById,
  updateAdditionalServiceById,
  getAdminServiceById,
  updateAdminService,
  deleteAdminService,
} = require("../controller/service")

var {
  createBaseService,
  listBaseServices,
  getBaseServiceById,
  updateBaseService,
  deleteBaseService,
} = require("../controller/baseService")

var { PicknDrop } = require("../controller/pickupndrop")

const router = express.Router()

const dealerServiceUpload = createS3Upload("services")
const adminServiceUpload = createS3Upload("admin-services")
const baseServiceUpload = createS3Upload("base-services")
const additionalServiceUpload = createS3Upload("additional-options")

/* =====================================================
   DEALER SERVICE ROUTES
===================================================== */
router.get("/servicelist", servicelist)
router.get("/edit-service/:id", getServiceById)

router.put("/update-service/:id", verifyDealerToken, dealerServiceUpload.single("images"), updateServiceById)

router.put("/updateservice", verifyDealerToken, dealerServiceUpload.fields([{ name: "service_image", maxCount: 1 }]), updateService)

router.delete("/deleteService", verifyDealerToken, deleteService)
router.get("/service/:id", singleService)

/* =====================================================
   DEALER SERVICES BY ID
===================================================== */
router.get("/dealer/:dealer_id", getServicesByDealer)

/* =====================================================
   PICK & DROP
===================================================== */
router.post("/PicknDrop", requireCustomer, requireOwnCustomerBody("user_id"), PicknDrop)

/* =====================================================
   BASE SERVICE ROUTES (Admin Only)
===================================================== */
router.post("/admin/base-services", requireAdmin, baseServiceUpload.single("image"), createBaseService)

router.get("/admin/base-services", requireAdmin, listBaseServices)

router.get("/admin/base-services/:id", requireAdmin, getBaseServiceById)

router.put("/admin/base-services/:id", requireAdmin, baseServiceUpload.single("image"), updateBaseService)

router.delete("/admin/base-services/:id", requireAdmin, deleteBaseService)

/* =====================================================
   ADMIN SERVICE ROUTES (Refactored)
===================================================== */
router.post("/adminservices/create", requireAdmin, adminServiceUpload.single("image"), addAdminService)

router.get("/adminservices", requireAdmin, listAdminServices)
router.get("/admin/services/:id", requireAdmin, getAdminServiceById)

router.put("/admin/services/:id", requireAdmin, adminServiceUpload.single("image"), updateAdminService)

router.delete("/admin/services/:id", requireAdmin, deleteAdminService)

/* =====================================================
   ADDITIONAL SERVICE ROUTES
===================================================== */
router.post("/create-additional-service", additionalServiceUpload.single("images"), addAdditionalService)

router.get("/additionalservicelist", additionalservicelist)

router.delete("/deleteAdditionalService/:id", deleteAdditionaalService)

router.get("/getAdditionalService/:id", getAdditionalServiceById)

router.put("/updateAdditionalService/:id", additionalServiceUpload.single("image"), updateAdditionalServiceById)

module.exports = router
