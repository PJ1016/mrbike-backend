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

const BikePriceSchema = new mongoose.Schema(
  {
    cc: { type: Number, required: true, min: 1 },
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
    const regex = /^MKBDASVC-(\d+)$/;

    const lastService = await this.constructor
      .findOne({ serviceId: { $regex: regex } })
      .sort({ serviceId: -1 })
      .exec();

    let maxNumber = 0;
    if (lastService) {
      const match = lastService.serviceId.match(regex);
      if (match && match[1]) {
        maxNumber = Number.parseInt(match[1], 10);
      }
    }

    const nextNumber = (maxNumber + 1).toString().padStart(3, "0");
    this.serviceId = `MKBDASVC-${nextNumber}`;
  }
  next();
});

module.exports = mongoose.model("additionalServices", additionalServiceSchema);
