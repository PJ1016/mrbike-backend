const mongoose = require("mongoose");

const chatHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customers",
      required: true,
      index: true,
    },
    messages: [
      {
        role: {
          type: String,
          enum: ["user", "assistant"],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
      index: true,
    },
    bikeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserBike",
    },
    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
    },
    recommendedServices: [
      {
        serviceId: mongoose.Schema.Types.ObjectId,
        serviceName: String,
        reason: String,
        estimatedCost: Number,
        estimatedTime: String,
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    closedAt: {
      type: Date,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
chatHistorySchema.index({ userId: 1, createdAt: -1 });
chatHistorySchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("ChatHistory", chatHistorySchema);
