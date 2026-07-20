const mongoose = require("mongoose");

const billSchema = new mongoose.Schema({
    booking_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        required: true,
        unique: true
    },
    payment_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
        required: false
    },
    bill_number: {
        type: String,
        required: true,
        unique: true
    },
    bill_date: {
        type: Date,
        default: Date.now
    },
    customer_details: {
        name: String,
        email: String,
        phone: String,
        address: String
    },
    bike_details: {
        model: String,
        registration: String,
        vin: String
    },
    services: [{
        name: String,
        price: Number,
        quantity: { type: Number, default: 1 },
        total: Number
    }],
    subtotal: {
        type: Number,
        required: true
    },
    pickup_charges: {
        type: Number,
        default: 0
    },
    drop_charges: {
        type: Number,
        default: 0
    },
    tax_amount: {
        type: Number,
        default: 0
    },
    tax_rate: {
        type: Number,
        default: 0
    },
    total_amount: {
        type: Number,
        required: true
    },
    commission_rate: {
        type: Number,
        default: 0
    },
    commission_amount: {
        type: Number,
        default: 0
    },
    dealer_earnings: {
        type: Number,
        default: 0
    },
    payment_details: {
        payment_method: String,
        transaction_id: String,
        payment_date: Date
    },
    status: {
        type: String,
        enum: ["generated", "sent", "paid", "cancelled"],
        default: "generated"
    }
}, {
    timestamps: true
});

// Indexes
billSchema.index({ booking_id: 1 });
billSchema.index({ bill_number: 1 });
billSchema.index({ bill_date: -1 });

module.exports = mongoose.model("Bill", billSchema);