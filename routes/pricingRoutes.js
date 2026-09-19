const express = require("express");
const router = express.Router();
const { getPricingQuote } = require("../controller/pricingController");
const { attachCustomerIfPresent } = require("../middlewares/optionalCustomer");

// POST /pricing/quote — live price preview, no database writes
router.post("/quote", attachCustomerIfPresent, getPricingQuote);

module.exports = router;
