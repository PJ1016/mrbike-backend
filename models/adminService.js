const mongoose = require("mongoose")
const AutoIncrement = require("mongoose-sequence")(mongoose)
const { nextShortId } = require("../helper/shortServiceId")

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
    isActive: {
      type: Boolean,
      default: true,
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
    try {
      this.serviceId = await nextShortId(this.constructor, "MKBDSVC")
    } catch (err) {
      return next(err)
    }
  }
  next()
})

module.exports = mongoose.model("AdminService", adminServiceSchema)
