const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true },
    category: { type: String, default: "General", trim: true },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

faqSchema.index({ isDeleted: 1, category: 1, displayOrder: 1 });
faqSchema.index({ question: "text", answer: "text" });

module.exports = mongoose.model("Faq", faqSchema);
