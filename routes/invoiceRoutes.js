const express = require('express');
const router = express.Router();
const { getInvoice, getDealerInvoices } = require("../controller/invoiceController");
const { verifyDealerToken, requireOwnDealer } = require("../middlewares/dealerAuth");

router.get('/booking/:bookingId', getInvoice);
router.get('/dealer/:dealerId', verifyDealerToken, requireOwnDealer('dealerId'), getDealerInvoices);

module.exports = router;
