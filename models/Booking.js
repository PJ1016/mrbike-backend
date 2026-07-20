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
      enum: [
        "pending",
        "confirmed",
        "completed",
        "awaiting_payment",
        "payment_selected",
        "ready_for_delivery",
        "delivered",
        "Payment",
        "rejected",
        "user_cancelled",
        "cancelled",
        "cash received",
        "expired",
      ],
      default: "pending",
    },

    dealerResponseStatus: {
      type: String,
      enum: ["awaiting", "accepted", "rejected", "expired"],
      default: "awaiting",
    },

    timerExpiresAt: { type: Date, default: null },

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

    // Snapshotted from Dealer.pickupCharges/dropCharges at bill-generation time —
    // only non-zero when this booking actually includes pickup/drop (pickupAndDropId set).
    pickupCharges: { type: Number, default: 0 },
    dropCharges: { type: Number, default: 0 },

    billStatus: {
      type: String,
      enum: ["pending", "paid", "cancelled"],
      default: "pending",
    },

    additionalNotes: { type: [String], default: [] },

    pickupDate: { type: Date, default: null },

    // Optional scheduling preferences
    scheduleDate: { type: String, default: null },   // e.g. "2026-05-10"
    timeSlot: { type: String, default: null },        // e.g. "10:00 AM - 12:00 PM"
    pickupAddress: { type: String, default: null },   // e.g. "123 MG Road, Bangalore"

    bookingId: { type: String, unique: true },

    create_date: { type: Date, default: Date.now },
    walletSettled: { type: Boolean, default: false },

    payment_method: {
      type: String,
      default: null,
      // Mongoose 6 enum validator rejects null even for non-required String fields.
      // Custom validator explicitly allows null (payment not yet selected) while
      // still rejecting any value that is not ONLINE or CASH.
      validate: {
        validator: function (v) {
          return v === null || v === undefined || v === "ONLINE" || v === "CASH";
        },
        message: "payment_method must be 'ONLINE' or 'CASH'",
      },
    },
    payment_status:      { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
    payment_verified:    { type: Boolean, default: false },

    otp_verified:        { type: Boolean, default: false },
    delivered_at:        { type: Date, default: null },

    otp_regen_count:     { type: Number, default: 0 },
    otp_failed_attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

bookingSchema.pre("save", async function (next) {
  if (!this.isNew || this.bookingId) return next();

  try {
    // 1. Get current time in IST (UTC + 5:30)
    const ISTOffset = 5.5 * 60 * 60 * 1000;
    const now = new Date();
    const istNow = new Date(now.getTime() + ISTOffset);
    
    // Month and Day in IST
    const mm = String(istNow.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(istNow.getUTCDate()).padStart(2, "0");
    const dateStr = mm + dd;

    // 2. Define range for "today" in IST boundaries, converted to UTC
    const startOfIstTodayUTC = new Date(istNow);
    startOfIstTodayUTC.setUTCHours(0, 0, 0, 0);
    // Move from IST 00:00 to UTC equivalent
    const startOfTodayUTC = new Date(startOfIstTodayUTC.getTime() - ISTOffset);
    
    const endOfIstTodayUTC = new Date(istNow);
    endOfIstTodayUTC.setUTCHours(23, 59, 59, 999);
    // Move from IST 23:59 to UTC equivalent
    const endOfTodayUTC = new Date(endOfIstTodayUTC.getTime() - ISTOffset);

    const count = await this.constructor.countDocuments({
      create_date: { $gte: startOfTodayUTC, $lte: endOfTodayUTC },
    });

    const sequence = String(count + 1).padStart(2, "0");
    this.bookingId = `MRB${dateStr}${sequence}`;
    next();
  } catch (error) {
    next(error);
  }
});

bookingSchema.plugin(AutoIncrement, { id: "booking_seq", inc_field: "id" });

bookingSchema.virtual("vehicleLifecycleStatus").get(function () {
  // 1. Cancelled / terminal states
  if (["rejected", "user_cancelled", "cancelled"].includes(this.status)) {
    return "Cancelled";
  }

  if (this.status === "expired") return "Dealer Did Not Respond";

  // 2. Initial Booking
  if (this.status === "pending") return "Booking Created";

  // 3. Pre-Service & In Service
  if (this.status === "confirmed") {
    // If it's a Pickup & Drop service
    if (this.pickupAndDropId) {
      if (this.pickupStatus === "pending") return "Pickup Scheduled";
      if (["pickedup", "completed", "arrived"].includes(this.pickupStatus))
        return "Service In Progress";
    } else {
      // If it's a direct customer visit to the shop
      return "Awaiting Customer Drop-off";
    }
  }

  // 4. Post-Service & Billing
  if (this.status === "completed") {
    if (!this.billGenerated) return "Service Completed (Pending Bill)";
    if (this.billStatus === "pending")
      return "Bill Generated (Pending Payment)";
  }

  // 5. Payment selection
  if (this.status === "awaiting_payment") {
    return "Service Completed — Select Payment Method";
  }

  if (this.status === "payment_selected") {
    return this.payment_method === "CASH"
      ? "Cash Payment — Awaiting Dealer Confirmation"
      : "Online Payment — Awaiting Confirmation";
  }

  // 6. Payment & Delivery closure (legacy paths)
  if (
    this.billStatus === "paid" ||
    ["Payment", "cash received"].includes(this.status)
  ) {
    return "Payment Completed (Ready for Delivery)";
  }

  // 7. Post-payment delivery
  if (this.status === "ready_for_delivery") {
    return "Payment Confirmed — Awaiting Handover OTP";
  }

  if (this.status === "delivered") {
    return "Bike Delivered";
  }

  return "Unknown Status";
});

bookingSchema.set("toJSON", { virtuals: true });
bookingSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Booking", bookingSchema);
