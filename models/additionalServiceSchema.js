// const mongoose = require("mongoose");
// const AutoIncrement = require("mongoose-sequence")(mongoose);
// const additionalServiceSchema = new mongoose.Schema(
//   {
//     id: {
//       type: Number,
//     },
//     name: String,
//     image: String,
//     description: String,
//     bikes: [
//       {
//         cc: Number,
//         price: Number
//       }
//     ],
//     dealer_id: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Vendor",
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// additionalServiceSchema.plugin(AutoIncrement, {
//   id: "additional_services_seq",
//   inc_field: "id"
// });

// module.exports = mongoose.model("additionalServices", additionalServiceSchema);

// models/additionalServices.js

const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose);
const { nextShortId } = require("../helper/shortServiceId");

const BikePriceSchema = new mongoose.Schema(
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
    cc: { type: Number, required: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const additionalServiceSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },

    serviceId: {
      type: String,
      unique: true,
    },

    // Reference to BaseAdditionalService
    base_additional_service_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BaseAdditionalService",
      required: true,
      index: true,
    },

    description: { type: String, default: "" },

    bikes: { type: [BikePriceSchema], default: [] },

    dealer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

additionalServiceSchema.plugin(AutoIncrement, {
  id: "additional_services_seq",
  inc_field: "id",
});

// Generate short ID (serviceId) in format MKBDASVC-###
additionalServiceSchema.pre("validate", async function (next) {
  if (!this.serviceId) {
    try {
      this.serviceId = await nextShortId(this.constructor, "MKBDASVC")
    } catch (err) {
      return next(err)
    }
  }
  next()
})

module.exports = mongoose.model("additionalServices", additionalServiceSchema);
