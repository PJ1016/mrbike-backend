const express = require('express');
const router = express.Router();
const { getInvoice } = require("../controller/invoiceController");

router.get('/booking/:bookingId', getInvoice);

module.exports = router;
