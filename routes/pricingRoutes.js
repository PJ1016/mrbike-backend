const express = require("express");
const router = express.Router();
const { getPricingQuote } = require("../controller/pricingController");

// POST /pricing/quote — live price preview, no database writes
router.post("/quote", getPricingQuote);

module.exports = router;
