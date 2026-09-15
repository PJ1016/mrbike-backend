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
    booking_number: {
        type: String,
        required: false
    },
    customer_details: {
        name: String,
        email: String,
        phone: String,
        address: String
    },
    dealer_details: {
        name: String,
        address: String,
        // Kept on the stored bill for internal/audit lookups only. It is
        // deliberately NOT part of the invoice API response — the number
        // printed on a customer's invoice is MR Bike's support number, see
        // `support_details` below and invoiceService#buildInvoiceResponse.
        phone: String,
        gst_number: String,
        logo_url: String
    },
    // MR Bike's own support contact, snapshotted at invoice time from
    // AppSettings so a later change to the support number never rewrites an
    // invoice that has already been issued. Bills created before this field
    // existed fall back to the current support number when rendered.
    support_details: {
        phone: String,
        email: String
    },
    bike_details: {
        model: String,
        registration: String,
        vin: String,
        company: String,
        engine_cc: Number
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
    // Towing charge, billed as its own line item (see the `services` array
    // above, which also carries a "Towing Charges" row) so the customer can
    // see exactly what they were charged for towing. 0 on every bill for a
    // rideable bike and on every bill issued before this feature existed.
    towing_charge: {
        type: Number,
        default: 0
    },
    tax_amount: {
        type: Number,
        default: 0
    },
    // MR Bike's platform/convenience fee — already included in total_amount,
    // but never in `subtotal`, `commission_amount` or `dealer_earnings`,
    // because it is the platform's charge and not the garage's. 0 on every
    // bill issued before the fee existed or while it is switched off.
    platform_fee: {
        type: Number,
        default: 0
    },
    platform_fee_label: {
        type: String,
        default: null
    },
    tax_rate: {
        type: Number,
        default: 0
    },
    discount_amount: {
        type: Number,
        default: 0
    },
    promo_code: {
        type: String,
        default: null
    },
    promo_name: {
        type: String,
        default: null
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
    // GST MR Bike charges the dealer on that commission. Already subtracted
    // from `dealer_earnings`; recovered from the dealer together with the
    // commission (₹100 commission at 18% = ₹118 deducted). Never part of what
    // the customer paid. 0 on every bill issued before this existed.
    commission_tax_rate: {
        type: Number,
        default: 0
    },
    commission_tax_amount: {
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