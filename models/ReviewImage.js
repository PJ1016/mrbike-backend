const mongoose = require("mongoose");

const reviewImageSchema = new mongoose.Schema({
  review_id: { type: mongoose.Schema.Types.ObjectId, ref: "rating", required: true, index: true },
  url: { type: String, required: true },
  key: { type: String, default: null },
  mimeType: { type: String, default: null },
  moderationStatus: { type: String, enum: ["published", "hidden"], default: "published" },
}, { timestamps: true });

module.exports = mongoose.model("ReviewImage", reviewImageSchema);
