const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true },
    category: { type: String, default: "General", trim: true },
    // Which app(s) this FAQ is shown in. Defaults to both so FAQs created
    // before this field existed (and any caller that omits it) keep showing
    // everywhere, matching the old single-audience behavior.
    appType: {
      type: [String],
      enum: ["user", "dealer"],
      default: ["user", "dealer"],
    },
    // Canonical https://www.youtube.com/embed/<id> form, or null. Normalized
    // once on write (see utils/youtube.js) so every consumer deals with one shape.
    videoUrl: { type: String, default: null, trim: true },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

faqSchema.index({ isDeleted: 1, category: 1, displayOrder: 1 });
faqSchema.index({ isDeleted: 1, appType: 1, displayOrder: 1 });
faqSchema.index({ question: "text", answer: "text" });

module.exports = mongoose.model("Faq", faqSchema);
