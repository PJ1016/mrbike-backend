const mongoose = require("mongoose");

const otpRequestLimitSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true, trim: true },
    requestCount: { type: Number, default: 0, min: 0 },
    pendingCount: { type: Number, default: 0, min: 0 },
    lockedUntil: { type: Date, default: null },
    lockedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

otpRequestLimitSchema.index({ phone: 1 }, { unique: true });

module.exports = mongoose.model("OtpRequestLimit", otpRequestLimitSchema);
