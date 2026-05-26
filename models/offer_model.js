const mongoose = require("mongoose")

const OfferSchema = new mongoose.Schema(
  {
    offerId: {
      type: String,
      unique: true,
    },
    service_id: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "service_type", // Dynamic reference based on service_type
    },
    service_type: {
      type: String,
      enum: ["AdminService", "BaseService", "BaseAdditionalService"],
      default: "AdminService",
    },
    promo_code: {
      type: String,
      unique: true,
    },
    // city: String,
    start_date: Date,
    end_date: Date,
    // noofuses: String,
    discount: Number,
    minorderamt: String,
    // repeat_usage: String,
  },
  {
    timestamps: true,
  },
)

// Pre-save hook to generate readable offerId (6 characters)
OfferSchema.pre("save", async function (next) {
  if (!this.isNew || this.offerId) return next();

  try {
    // Generate offerId in format: OFF + 3-digit sequence
    // Example: OFF001, OFF002, etc.
    const count = await mongoose.model("offer").countDocuments();
    const sequence = String(count + 1).padStart(3, "0");
    this.offerId = `OFF${sequence}`;
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model("offer", OfferSchema)
