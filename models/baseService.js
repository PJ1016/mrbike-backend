const mongoose = require("mongoose")
const AutoIncrement = require("mongoose-sequence")(mongoose)

const baseServiceSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
    },
    // Service Name
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    // Service image
    image: {
      type: String,
      required: true,
    },
    // Service description
    description: {
      type: String,
      trim: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceCategory",
      default: null,
    },
    // Reference/starting price shown to users before a dealer/bike-specific
    // price is resolved (AdminService.bikes[].price remains the source of
    // truth for what a customer is actually charged).
    basePrice: {
      type: Number,
      default: 0,
    },
    // Estimated duration in minutes.
    duration: {
      type: Number,
      default: 0,
    },
    pickupAvailable: {
      type: Boolean,
      default: false,
    },
    warranty: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

baseServiceSchema.plugin(AutoIncrement, {
  id: "base_service_seq",
  inc_field: "id",
})

module.exports = mongoose.model("BaseService", baseServiceSchema)
