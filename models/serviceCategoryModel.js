const mongoose = require("mongoose")
const AutoIncrement = require("mongoose-sequence")(mongoose)

const serviceCategorySchema = new mongoose.Schema(
  {
    id: {
      type: Number,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    icon: {
      type: String,
      required: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
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

serviceCategorySchema.plugin(AutoIncrement, {
  id: "service_category_seq",
  inc_field: "id",
})

module.exports = mongoose.model("ServiceCategory", serviceCategorySchema)
