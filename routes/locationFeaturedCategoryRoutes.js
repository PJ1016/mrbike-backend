const express = require("express");
const router = express.Router();
const { verifyToken } = require("../helper/verifyAuth");
const { requireAdmin } = require("../middlewares/requireAdmin");
const { requireCustomer } = require("../middlewares/customerAuth");
const { createS3Upload } = require("../utils/s3Upload");
const ctrl = require("../controller/locationFeaturedCategoryController");

const upload = createS3Upload("location-featured-categories");

// Static paths must be declared before /:id to avoid route shadowing
router.get("/location-search", requireAdmin, ctrl.locationSearch);
router.get("/nearby", requireCustomer, ctrl.getUserFeaturedCategories);

router.get("/", requireAdmin, ctrl.getList);
router.get("/:id", requireAdmin, ctrl.getSingle);
router.post("/", requireAdmin, upload.single("categoryImage"), ctrl.create);
router.put("/:id", requireAdmin, upload.single("categoryImage"), ctrl.update);
router.delete("/:id", requireAdmin, ctrl.remove);
router.patch("/:id/status", requireAdmin, ctrl.toggleStatus);

module.exports = router;
