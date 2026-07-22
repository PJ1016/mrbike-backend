const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Bill = require("../models/billSchema");
const { getOrCreateInvoice, buildInvoiceResponse } = require("../services/invoiceService");

const BILL_STATUS_VALUES = ["paid", "pending", "cancelled"];

const SORT_OPTIONS = {
    newest: { bill_date: -1 },
    oldest: { bill_date: 1 },
    amount_high: { total_amount: -1 },
    amount_low: { total_amount: 1 },
};

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Resolves the {$gte, $lte} range for the list's Date filter. "custom" reads
// startDate/endDate from the query; every other option is computed from the
// server's current time. Returns null when no date filter should be applied.
function buildDateRange(dateFilter, startDate, endDate) {
    const now = new Date();

    if (dateFilter === "custom") {
        const range = {};
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            range.$gte = start;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            range.$lte = end;
        }
        return Object.keys(range).length ? range : null;
    }

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const start = new Date(now);

    switch (dateFilter) {
        case "today":
            start.setHours(0, 0, 0, 0);
            break;
        case "last7":
            start.setDate(start.getDate() - 6);
            start.setHours(0, 0, 0, 0);
            break;
        case "last30":
            start.setDate(start.getDate() - 29);
            start.setHours(0, 0, 0, 0);
            break;
        case "thisMonth":
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            break;
        default:
            return null;
    }

    return { $gte: start, $lte: end };
}

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

// GET /bikedoctor/invoice/dealer/:dealerId
// Lightweight, paginated invoice history for the Dealer App's Invoices list
// screen. Bill already denormalizes customer/bike/amount at invoice-creation
// time, so a single $lookup onto Booking (for dealer scoping + billStatus)
// is enough — no per-row population of user/bike/dealer documents. Never
// returns the pricing breakdown (subtotal/tax/commission/dealerEarnings);
// that only comes from GET /invoice/booking/:bookingId when an invoice is
// opened.
const getDealerInvoices = async (req, res) => {
    try {
        const { dealerId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(dealerId)) {
            return res.status(400).json({ success: false, message: "Invalid dealer id" });
        }

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const skip = (page - 1) * limit;

        const { search, status, dateFilter, startDate, endDate, sortBy } = req.query;

        const match = { "booking.dealer_id": new mongoose.Types.ObjectId(dealerId) };

        if (status && status !== "all" && BILL_STATUS_VALUES.includes(status)) {
            match["booking.billStatus"] = status;
        }

        const dateRange = buildDateRange(dateFilter, startDate, endDate);
        if (dateRange) {
            match.bill_date = dateRange;
        }

        if (search && String(search).trim()) {
            const regex = new RegExp(escapeRegex(String(search).trim()), "i");
            match.$or = [
                { bill_number: regex },
                { booking_number: regex },
                { "customer_details.name": regex },
                { "bike_details.registration": regex },
            ];
        }

        const sort = SORT_OPTIONS[sortBy] || SORT_OPTIONS.newest;

        const pipeline = [
            {
                $lookup: {
                    from: "bookings",
                    localField: "booking_id",
                    foreignField: "_id",
                    as: "booking",
                },
            },
            { $unwind: "$booking" },
            { $match: match },
            {
                $facet: {
                    data: [
                        { $sort: sort },
                        { $skip: skip },
                        { $limit: limit },
                        {
                            $project: {
                                _id: 0,
                                invoiceNumber: "$bill_number",
                                bookingId: "$booking._id",
                                bookingNumber: "$booking_number",
                                customerName: "$customer_details.name",
                                bikeNumber: "$bike_details.registration",
                                invoiceDate: "$bill_date",
                                paymentStatus: "$booking.billStatus",
                                totalPaid: "$total_amount",
                            },
                        },
                    ],
                    totalCount: [{ $count: "count" }],
                },
            },
        ];

        const [result] = await Bill.aggregate(pipeline);
        const invoices = result?.data || [];
        const totalInvoices = result?.totalCount?.[0]?.count || 0;
        const totalPages = Math.max(1, Math.ceil(totalInvoices / limit));

        return res.status(200).json({
            success: true,
            message: "Invoices fetched successfully",
            data: {
                invoices,
                pagination: {
                    currentPage: page,
                    pageSize: limit,
                    totalInvoices,
                    totalPages,
                    hasMore: page < totalPages,
                },
            },
        });
    } catch (error) {
        console.error("Get Dealer Invoices Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch invoices",
            error: error.message,
        });
    }
};

module.exports = { getInvoice, getDealerInvoices };
