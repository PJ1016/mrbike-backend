const mongoose = require("mongoose");
const AutoIncrement = require('mongoose-sequence')(mongoose);

const walletSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
    },
    dealer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor"
    },
    Amount: {
        type: Number
    },
    Type: {
        type: String,
        enum: ["Credit", "Debit", "Pending"],
    },
    Note: {
        type: String
    },
    Total: {
        type: Number
    },
    order_status: {
        type: String,
        enum: ["ACTIVE", "PAID", "PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "EXPIRED", "APPROVED", "REJECTED"],
        default: "PENDING",
    },
    // settlement_online | settlement_cash | withdrawal | deposit | manual | reconciliation | rollback
    transaction_type: {
        type: String,
        enum: ["settlement_online", "settlement_cash", "withdrawal", "deposit", "manual", "reconciliation", "rollback"],
        default: "manual",
    },
    pre_balance: {
        type: Number,
    },
    booking_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
    },
    performed_by: {
        type: mongoose.Schema.Types.ObjectId,
    },
}, {
    timestamps: true,
});

walletSchema.plugin(AutoIncrement, { id: "wallet_seq", inc_field: "id" });

module.exports = mongoose.model("Wallet", walletSchema);
