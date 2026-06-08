const express = require("express");
const router = express.Router();
const { getFinanceSummary } = require("../controller/adminFinance");

// GET /bikedoctor/finance/summary
router.get("/summary", getFinanceSummary);

module.exports = router;
