const express = require("express");
const router = express.Router();
const { requireAdmin } = require("../middlewares/requireAdmin");
const {
  getFinanceSummary,
  getDealerWallets,
  getDealerWalletDetails,
  createAdminWalletAdjustment,
  getWalletReconciliation,
} = require("../controller/adminFinance");
const { getTransactionsList, getTransactionDetails } = require("../controller/adminTransactions");

// ── Dashboard Summary ─────────────────────────────────────────────────────────
// GET /bikedoctor/finance/summary
router.get("/summary", requireAdmin, getFinanceSummary);

// ── Dealer Wallets ────────────────────────────────────────────────────────────
// GET /bikedoctor/finance/wallets
// GET /bikedoctor/finance/wallets/:id
router.get("/wallets", requireAdmin, getDealerWallets);
router.get("/wallets/:id", requireAdmin, getDealerWalletDetails);
router.post("/wallets/:id/adjustments", requireAdmin, createAdminWalletAdjustment);
router.get("/reconciliation", requireAdmin, getWalletReconciliation);

// ── Transactions ───────────────────────────────────────────────────────────────
// GET /bikedoctor/finance/transactions
// GET /bikedoctor/finance/transactions/:id
router.get("/transactions", requireAdmin, getTransactionsList);
router.get("/transactions/:id", requireAdmin, getTransactionDetails);

module.exports = router;
