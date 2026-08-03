var express = require("express")
var path = require("path")
const { verifyToken } = require("../helper/verifyAuth")
const { requireAdmin } = require("../middlewares/requireAdmin")
var { addbanner, bannerlist, deletebanner, editbanner } = require("../controller/banner")
const { createS3Upload } = require("../utils/s3Upload")
const router = express.Router()

const upload = createS3Upload("banners")

/* POST users listing. */
router.post("/addbanner", requireAdmin, upload.single("images"), addbanner)
router.get("/bannerlist", bannerlist)
router.delete("/deletebanner", requireAdmin, deletebanner)
router.put("/editbanner", requireAdmin, editbanner)

module.exports = router
