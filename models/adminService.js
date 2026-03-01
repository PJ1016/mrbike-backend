const mongoose = require("mongoose")
const AutoIncrement = require("mongoose-sequence")(mongoose)

const adminServiceSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
    },
    serviceId: {
      type: String,
      unique: true,
    },
    base_service_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BaseService",
      required: true,
    },

    // Select company
    companies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BikeCompany",
        required: true,
      },
    ],

    // CC-wise base pricing
    bikes: [
      {
        model_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "BikeModel",
          required: false,
        },
        variant_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "BikeVariant",
          required: false,
        },
        cc: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],
    dealer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    description: {
      type: String,
      required: false,
      default: "",
    },
  },
  {
    timestamps: true,
  },
)

adminServiceSchema.plugin(AutoIncrement, {
  id: "admin_service_seq",
  inc_field: "id",
})

adminServiceSchema.pre("validate", async function (next) {
  if (!this.serviceId) {
    const regex = /^MKBDSVC-(\d+)$/

    const lastService = await this.constructor
      .findOne({ serviceId: { $regex: regex } })
      .sort({ serviceId: -1 })
      .exec()

    let maxNumber = 0
    if (lastService) {
      const match = lastService.serviceId.match(regex)
      if (match && match[1]) {
        maxNumber = Number.parseInt(match[1], 10)
      }
    }

    const nextNumber = (maxNumber + 1).toString().padStart(3, "0")
    this.serviceId = `MKBDSVC-${nextNumber}`
  }
  next()
})

module.exports = mongoose.model("AdminService", adminServiceSchema)
