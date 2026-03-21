var express = require("express")
var path = require("path")
const { createS3Upload } = require("../utils/s3Upload")

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

router.put("/update-service/:id", dealerServiceUpload.single("images"), updateServiceById)

router.put("/updateservice", dealerServiceUpload.fields([{ name: "service_image", maxCount: 1 }]), updateService)

router.delete("/deleteService", deleteService)
router.get("/service/:id", singleService)

/* =====================================================
   DEALER SERVICES BY ID
===================================================== */
router.get("/dealer/:dealer_id", getServicesByDealer)

/* =====================================================
   PICK & DROP
===================================================== */
router.post("/PicknDrop", PicknDrop)

/* =====================================================
   BASE SERVICE ROUTES (Admin Only)
===================================================== */
router.post("/admin/base-services", baseServiceUpload.single("image"), createBaseService)

router.get("/admin/base-services", listBaseServices)

router.get("/admin/base-services/:id", getBaseServiceById)

router.put("/admin/base-services/:id", baseServiceUpload.single("image"), updateBaseService)

router.delete("/admin/base-services/:id", deleteBaseService)

/* =====================================================
   ADMIN SERVICE ROUTES (Refactored)
===================================================== */
router.post("/adminservices/create", adminServiceUpload.single("image"), addAdminService)

router.get("/adminservices", listAdminServices)
router.get("/admin/services/:id", getAdminServiceById)

router.put("/admin/services/:id", adminServiceUpload.single("image"), updateAdminService)

router.delete("/admin/services/:id", deleteAdminService)

/* =====================================================
   ADDITIONAL SERVICE ROUTES
===================================================== */
router.post("/create-additional-service", additionalServiceUpload.single("images"), addAdditionalService)

router.get("/additionalservicelist", additionalservicelist)

router.delete("/deleteAdditionalService/:id", deleteAdditionaalService)

router.get("/getAdditionalService/:id", getAdditionalServiceById)

router.put("/updateAdditionalService/:id", additionalServiceUpload.single("image"), updateAdditionalServiceById)

module.exports = router
