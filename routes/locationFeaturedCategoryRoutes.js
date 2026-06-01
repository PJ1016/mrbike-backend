const express = require("express");
const router = express.Router();
const { verifyToken } = require("../helper/verifyAuth");
const { createS3Upload } = require("../utils/s3Upload");
const ctrl = require("../controller/locationFeaturedCategoryController");

const upload = createS3Upload("location-featured-categories");

// Static paths must be declared before /:id to avoid route shadowing
router.get("/location-search", verifyToken, ctrl.locationSearch);
router.get("/nearby", verifyToken, ctrl.getUserFeaturedCategories);

router.get("/", verifyToken, ctrl.getList);
router.get("/:id", verifyToken, ctrl.getSingle);
router.post("/", verifyToken, upload.single("categoryImage"), ctrl.create);
router.put("/:id", verifyToken, upload.single("categoryImage"), ctrl.update);
router.delete("/:id", verifyToken, ctrl.remove);
router.patch("/:id/status", verifyToken, ctrl.toggleStatus);

module.exports = router;
