var express = require("express")
var path = require("path")
const { verifyToken } = require("../helper/verifyAuth")
var { addbanner, bannerlist, deletebanner, editbanner } = require("../controller/banner")
const { createS3Upload } = require("../utils/s3Upload")
const router = express.Router()

const upload = createS3Upload("banners")

/* POST users listing. */
router.post("/addbanner", upload.single("images"), addbanner)
router.get("/bannerlist", bannerlist)
router.delete("/deletebanner", deletebanner)
router.put("/editbanner", editbanner)

module.exports = router
