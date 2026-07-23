const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../../middlewares/requireAdmin");
const { getReferralTransactions } = require("../../controller/preferences/referralTransactionsController");

router.get("/", requireAdmin, getReferralTransactions);

module.exports = router;
