const mongoose = require("mongoose");

const DISCOUNT_TYPES = ["percentage", "flat"];

const promoCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discountType: { type: String, enum: DISCOUNT_TYPES, required: true },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscount: { type: Number, default: null },
    minOrder: { type: Number, default: null },
    usageLimit: { type: Number, required: true, min: 1 },
    usedCount: { type: Number, default: 0 },
    perUserLimit: { type: Number, required: true, min: 1 },
    validFrom: { type: Date, required: true },
    validTo: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

promoCodeSchema.index({ isDeleted: 1, isActive: 1 });

module.exports = mongoose.model("PromoCode", promoCodeSchema);
module.exports.DISCOUNT_TYPES = DISCOUNT_TYPES;
