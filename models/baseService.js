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
