const mongoose = require("mongoose");

const bookingV2Schema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customers",
      required: true,
    },
    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    items: [
      {
        serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminService" },
        variantId: { type: mongoose.Schema.Types.ObjectId },
        serviceName: { type: String, required: true },
        bikeName: { type: String, required: true },
        price: { type: Number, required: true },
      },
    ],
    logistics: {
      mode: { type: String, enum: ["pickup", "self-drop"], default: "self-drop" },
      pickupCharges: { type: Number, default: 0 },
      address: { type: String },
    },
    schedule: {
      date: { type: String, required: true }, // Format: YYYY-MM-DD
      timeSlot: { type: String, required: true },
    },
    totals: {
      subtotal: { type: Number, required: true },
      tax: { type: Number, default: 0 },
      grandTotal: { type: Number, required: true },
    },
    otp: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "picked-up", "in-progress", "ready-for-delivery", "completed", "cancelled"],
      default: "pending",
    },
    timeline: [
      {
        status: { type: String },
        time: { type: Date },
        completed: { type: Boolean, default: false },
        comment: { type: String },
      },
    ],
    additionalCharges: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Pre-save hook to generate bookingId and initialize timeline
bookingV2Schema.pre("save", async function (next) {
  if (this.isNew) {
    // Generate Booking ID: BK-YYYY-XXXXX
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments();
    const sequence = String(count + 1).padStart(5, "0");
    this.bookingId = `BK-${year}-${sequence}`;

    // Initialize timeline
    if (!this.timeline || this.timeline.length === 0) {
      this.timeline = [
        { status: "pending", time: new Date(), completed: true },
        { status: "picked-up", time: null, completed: false },
        { status: "in-progress", time: null, completed: false },
        { status: "ready-for-delivery", time: null, completed: false },
        { status: "completed", time: null, completed: false },
      ];
    }
  }
  next();
});

module.exports = mongoose.model("BookingV2", bookingV2Schema);
