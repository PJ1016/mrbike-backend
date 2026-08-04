const mongoose = require("mongoose");

const cashfreeWebhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true },
    eventType: { type: String, default: null },
    orderId: { type: String, default: null, index: true },
    paymentId: { type: String, default: null, index: true },
    status: {
      type: String,
      enum: ["PROCESSING", "COMPLETED"],
      default: "PROCESSING",
      required: true,
    },
    webhookTimestamp: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

cashfreeWebhookEventSchema.index(
  { eventId: 1 },
  { unique: true, name: "cashfree_webhook_event_id_unique" },
);
cashfreeWebhookEventSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "cashfree_webhook_event_expiry_ttl" },
);

module.exports = mongoose.model("CashfreeWebhookEvent", cashfreeWebhookEventSchema);
