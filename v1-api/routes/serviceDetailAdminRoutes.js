const express = require("express")
const router = express.Router()
const { requireAdmin } = require("../../middlewares/requireAdmin")
const {
  serviceMediaUpload,
  getServiceDetail,
  previewServiceDetail,
  upsertServiceDetail,
  setPublishState,
  uploadServiceMedia,
  deleteServiceMedia,
} = require("../controllers/serviceDetailAdminController")

// Service Detail CMS — admin only, every route. These sit alongside (and
// never replace) the existing base-service CRUD at
// /bikedoctor/service/admin/base-services, which remains the sole writer of
// name/image/description/basePrice/duration/warranty/category.
//
// More specific paths are registered before /:id/detail so the bare detail
// route can never swallow /preview, /publish or /media.
router.get("/admin/services/:id/detail/preview", requireAdmin, previewServiceDetail)
router.patch("/admin/services/:id/detail/publish", requireAdmin, setPublishState)
router.post("/admin/services/:id/detail/media", requireAdmin, serviceMediaUpload.array("images", 12), uploadServiceMedia)
router.delete("/admin/services/:id/detail/media", requireAdmin, deleteServiceMedia)
router.get("/admin/services/:id/detail", requireAdmin, getServiceDetail)
router.put("/admin/services/:id/detail", requireAdmin, upsertServiceDetail)

module.exports = router
