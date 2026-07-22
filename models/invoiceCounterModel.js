const mongoose = require("mongoose");

// One document per calendar year (_id: "invoice_2026"). $inc via
// findOneAndUpdate is atomic in MongoDB, so concurrent invoice creations
// (webhook + cash-confirm racing) can never hand out the same sequence.
const invoiceCounterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
});

module.exports = mongoose.model("InvoiceCounter", invoiceCounterSchema);
