const Booking = require("../models/Booking");
const Bill = require("../models/billSchema");
const { getOrCreateInvoice, buildInvoiceResponse } = require("../services/invoiceService");

// GET /bikedoctor/invoice/booking/:bookingId
// Single endpoint consumed identically by the User App, Dealer App and
// Admin Panel. Always returns the one existing invoice for a booking if
// present. Only ever creates a new one when the booking's payment is
// actually complete (billStatus === "paid") — never for an unpaid booking,
// regardless of its status (e.g. "completed" while still unpaid).
const getInvoice = async (req, res) => {
    try {
        const { bookingId } = req.params;

        let bill = await Bill.findOne({ booking_id: bookingId });

        if (!bill) {
            const booking = await Booking.findById(bookingId).select("billStatus payment_method");
            if (!booking) {
                return res.status(404).json({ success: false, message: "Booking not found" });
            }

            if (booking.billStatus !== "paid") {
                return res.status(404).json({ success: false, message: "Invoice not available yet" });
            }

            bill = await getOrCreateInvoice(bookingId, {
                payment_method: booking.payment_method || "N/A",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Invoice fetched successfully",
            data: buildInvoiceResponse(bill),
        });
    } catch (error) {
        console.error("Get Invoice Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch invoice",
            error: error.message,
        });
    }
};

module.exports = { getInvoice };
