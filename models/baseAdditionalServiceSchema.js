const mongoose = require("mongoose")
const AutoIncrement = require("mongoose-sequence")(mongoose)

const baseAdditionalServiceSchema = new mongoose.Schema(
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
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

baseAdditionalServiceSchema.plugin(AutoIncrement, {
  id: "base_additional_service_seq",
  inc_field: "id",
})

module.exports = mongoose.model("BaseAdditionalService", baseAdditionalServiceSchema)
