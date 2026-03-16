const mongoose = require("mongoose")
const AutoIncrement = require("mongoose-sequence")(mongoose)

const CustomerSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      default: 0,
    },
    first_name: {
      type: String,
      default: "",
    },
    last_name: {
      type: String,
      default: "",
    },
    pincode: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      default: "",
    },
    password: {
      type: String,
      select: false,
    },
    phone: {
      type: String,
      default: null,
    },
    state: {
      type: String,
      default: "",
    },
    city: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    image: {
      type: String,
      default: "",
    },
    ftoken: {
      type: String,
      default: "",
    },
    device_token: {
      type: String,
      default: "",
    },
    userBike: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserBike",
        default: [],
      },
    ],
    otp: {
      type: Number,
      default: null,
    },
    isProfile: {
      type: Boolean,
      default: false,
    },
    reward_points: { type: Number, default: 0 },
  },

  {
    timestamps: true,
  },
)

CustomerSchema.virtual("customerId").get(function () {
  if (!this.id) return null
  return `MRBDC${this.id.toString().padStart(4, "0")}`
})

CustomerSchema.set("toJSON", { virtuals: true })
CustomerSchema.set("toObject", { virtuals: true })

CustomerSchema.plugin(AutoIncrement, { id: "user_seq", inc_field: "id" })
module.exports = mongoose.model("customers", CustomerSchema)
