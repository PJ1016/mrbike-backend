const mongoose = require("mongoose");

const reviewReplySchema = new mongoose.Schema({
  review_id: { type: mongoose.Schema.Types.ObjectId, ref: "rating", required: true, unique: true },
  authorType: { type: String, enum: ["dealer", "admin"], required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, required: true },
  body: { type: String, required: true, trim: true, maxlength: 1000 },
}, { timestamps: true });

module.exports = mongoose.model("ReviewReply", reviewReplySchema);
