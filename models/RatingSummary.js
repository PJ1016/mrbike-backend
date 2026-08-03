const mongoose = require("mongoose");

const ratingSummarySchema = new mongoose.Schema({
  entityType: { type: String, enum: ["dealer", "service", "global"], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
  averageRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  recommendationRate: { type: Number, default: 0 },
  distribution: { type: Map, of: Number, default: {} },
  categoryScores: { type: Map, of: Number, default: {} },
}, { timestamps: true });

ratingSummarySchema.index({ entityType: 1, entityId: 1 }, { unique: true });
module.exports = mongoose.model("RatingSummary", ratingSummarySchema);
