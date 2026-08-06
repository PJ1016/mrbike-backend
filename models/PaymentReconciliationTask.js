const mongoose = require("mongoose");

const paymentReconciliationTaskSchema = new mongoose.Schema(
  {
    dedupeKey: { type: String, required: true },
    taskType: {
      type: String,
      required: true,
      enum: ["BOOKING_SYNC", "INVOICE", "WALLET", "NOTIFICATION", "INVOICE_PAYMENT_MISMATCH"],
    },
    booking_id: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    payment_id: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null, index: true },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lockedUntil: { type: Date, default: null },
    lastError: { type: String, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

paymentReconciliationTaskSchema.index(
  { dedupeKey: 1 },
  { unique: true, name: "payment_reconciliation_dedupe_unique" },
);

module.exports = mongoose.model("PaymentReconciliationTask", paymentReconciliationTaskSchema);
