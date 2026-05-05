const express = require("express");
const router = express.Router();
const bannerController = require("../controllers/bannerController");

router.get("/", bannerController.getBanners);

module.exports = router;
