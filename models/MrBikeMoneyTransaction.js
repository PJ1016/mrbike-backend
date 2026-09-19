const mongoose = require("mongoose");

const mrBikeMoneyTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "customers", required: true, index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null, index: true },
    referralTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: "ReferralTransaction", default: null },
    type: { type: String, enum: ["credit", "debit", "refund", "adjustment"], required: true },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    description: { type: String, default: "" },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MrBikeMoneyTransaction", mrBikeMoneyTransactionSchema);
