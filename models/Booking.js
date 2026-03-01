// const mongoose = require("mongoose");
// const AutoIncrement = require("mongoose-sequence")(mongoose);

// const bookingSchema = new mongoose.Schema(
//   {
//     id: { type: Number },
//     user_id: { type: mongoose.Schema.Types.ObjectId, ref: "customers", required: true },
//     dealer_id: { type: mongoose.Schema.Types.ObjectId, ref: "dealer", required: true },
//     services: [{ type: mongoose.Schema.Types.ObjectId, ref: "service" }],
//     pickupAndDropId: { type: mongoose.Schema.Types.ObjectId, ref: "PicknDrop", default: null },
//     additionalServices: {
//       type: [{ type: mongoose.Schema.Types.ObjectId, ref: "additionalServices" }],
//       default: [],
//     },
//     status: {
//       type: String,
//       enum: ["pending", "confirmed", "completed", "Payment", "rejected", "user_cancelled", "cash received"],
//       default: "pending"
//     },
//     userBike_id: { type: mongoose.Schema.Types.ObjectId, ref: "UserBike", required: true },
//     pickupStatus: {
//       type: String,
//       default: "pending"
//     },
//     serviceDate: { type: Date },
//     billGenerated: { type: Boolean, default: false },
//     lastServiceKm: { type: Number, default: 0 },
//     serviceSummary: [{
//       serviceName: { type: String, default: "" },
//       price: { type: Number, default: 0 }
//     }],
//     otp: { type: Number, default: null },
//     tax: { type: Number, default: 0 },
//     totalBill: { type: Number, default: 0 },

//     billStatus: {
//       type: String,
//       enum: ["pending", "paid", "cancelled"],
//       default: "pending"
//     },
//     additionalNotes: { type: [String], default: [] },


//     pickupDate: { type: Date, default: null },
//     create_date: { type: Date, default: Date.now },
//     dealer_id: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Vendor'
//     },
//     services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'service' }],
//     // services: {
//     //   type: mongoose.Schema.Types.ObjectId,
//     //   ref: 'service'
//     // },
//   },

//   { timestamps: true }
// );

// bookingSchema.plugin(AutoIncrement, { id: "booking_seq", inc_field: "id" });
// bookingSchema.virtual("bookingId").get(function () {
//   return `B-${this.id.toString().padStart(2, "0")}`;
// });
// bookingSchema.set("toJSON", { virtuals: true });

// module.exports = mongoose.model("Booking", bookingSchema);

// models/Booking.js
const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose);

const bookingSchema = new mongoose.Schema(
  {
    id: { type: Number },

    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "customers", required: true },
    dealer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },

    services: [{ type: mongoose.Schema.Types.ObjectId, ref: "AdminService" }],
    additionalServices: [{ type: mongoose.Schema.Types.ObjectId, ref: "additionalServices" }],

    pickupAndDropId: { type: mongoose.Schema.Types.ObjectId, ref: "PicknDrop", default: null },

    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "Payment", "rejected", "user_cancelled", "cash received"],
      default: "pending",
    },

    userBike_id: { type: mongoose.Schema.Types.ObjectId, ref: "UserBike", required: true },

    pickupStatus: { type: String, default: "pending" },

    serviceDate: { type: Date },
    billGenerated: { type: Boolean, default: false },
    lastServiceKm: { type: Number, default: 0 },

    serviceSummary: [
      {
        serviceName: { type: String, default: "" },
        price: { type: Number, default: 0 },
      },
    ],

    // 🔄 replaced single 'otp' with two distinct OTPs
    pickupOtp: { type: Number, default: null },
    deliveryOtp: { type: Number, default: null },

    tax: { type: Number, default: 0 },
    totalBill: { type: Number, default: 0 },

    billStatus: {
      type: String,
      enum: ["pending", "paid", "cancelled"],
      default: "pending",
    },

    additionalNotes: { type: [String], default: [] },

    pickupDate: { type: Date, default: null },

    create_date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

bookingSchema.plugin(AutoIncrement, { id: "booking_seq", inc_field: "id" });
// bookingSchema.virtual("bookingId").get(function () {
//   return `B-${this.id.toString().padStart(2, "0")}`;
// });
bookingSchema.virtual("bookingId").get(function () {
  if (!this.id) return null; 
  return `B-${this.id.toString().padStart(2, "0")}`;
});

bookingSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Booking", bookingSchema);
