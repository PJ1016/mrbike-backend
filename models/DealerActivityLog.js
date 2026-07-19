const mongoose = require("mongoose");

const dealerActivityLogSchema = new mongoose.Schema({
  dealerId: { type: mongoose.Schema.Types.ObjectId, ref: "Dealer", required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  action: {
    type: String,
    enum: [
      "Dealer Approved",
      "Dealer Rejected",
      "Dealer Blocked",
      "Dealer Activated",
      "Dealer Inactivated",
      "Document Requested",
      "Document Approved",
      "Document Rejected",
      "Re-verification Submitted",
    ],
    required: true,
  },
  reason: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("DealerActivityLog", dealerActivityLogSchema);
