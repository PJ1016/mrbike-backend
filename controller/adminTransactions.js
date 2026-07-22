/**
 * Admin Transactions Controller
 *
 * "Transactions" for the admin Finance module are the dealer wallet ledger
 * entries (Wallet_modal) — settlements, withdrawals, deposits, manual
 * adjustments and reconciliations — enriched with the booking, dealer and
 * customer they relate to, plus the raw payment-gateway record (Payment)
 * when one exists for the booking.
 *
 * Endpoints:
 *   GET /bikedoctor/finance/transactions      → getTransactionsList
 *   GET /bikedoctor/finance/transactions/:id  → getTransactionDetails
 */

const mongoose = require("mongoose");
const Wallet = require("../models/Wallet_modal");
const Payment = require("../models/Payment");
const Booking = require("../models/Booking");

const TRANSACTION_TYPES = [
  "settlement_online",
  "settlement_cash",
  "withdrawal",
  "deposit",
  "manual",
  "reconciliation",
  "rollback",
];
const ORDER_STATUSES = [
  "ACTIVE",
  "PAID",
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "APPROVED",
  "REJECTED",
];
const PAYMENT_METHODS = ["ONLINE", "CASH"];

function formatDealerId(numericId) {
  if (!numericId && numericId !== 0) return null;
  return `MRBD${numericId.toString().padStart(4, "0")}`;
}

function formatTransactionId(numericId) {
  return `TXN${(numericId || 0).toString().padStart(6, "0")}`;
}

function customerName(customer) {
  if (!customer) return null;
  return [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || null;
}

// Commission only applies to settlement transactions — withdrawals/deposits/
// manual adjustments/reconciliations don't carry a per-transaction commission.
//
// IMPORTANT: never recomputed from the dealer's *current* commission rate —
// a dealer's commission % can be edited later (see routes/dealerRoutes.js PUT
// /editDealer), which would silently rewrite the commission shown against old
// transactions if we recomputed it from `dealer.commission` today.
//
// For bookings that have a pricing snapshot (pricingVersion set), the
// commission/dealer-share/tax/order-amount are read directly from that
// frozen snapshot (Booking.commissionAmount/dealerEarnings/taxAmount/subtotal
// — see services/pricingEngine.js). For bookings that predate the snapshot,
// we fall back to reconstructing the numbers from the ledger entry actually
// recorded at settlement time (helper/walletSettlement.js), since:
//   ONLINE: wallet.Amount = orderAmount - commissionAmount  (Dealer Earnings, net credit — tax excluded)
//   CASH:   wallet.Amount = commissionAmount                (debited from dealer)
// where orderAmount = Booking.totalBill (the legacy Subtotal mirror) — tax
// (Booking.tax) never enters the dealer-earnings/commission math, it belongs
// to platform accounting only.
//
// NOTE: wallet ledger rows settled before this formula was fixed used the old
// (incorrect) `customerTotal - commissionAmount` credit — this reconstruction
// assumes the corrected formula and will misstate `commission` for those
// historical rows. See services/pricingEngine.js and helper/walletSettlement.js
// for the fix; pre-existing rows need a separate reconciliation pass, not a
// change to this read-only reconstruction.
function computeCommission(transactionType, walletAmount, orderAmount, taxAmount) {
  const amount = walletAmount || 0;
  const total = orderAmount || 0;
  if (transactionType === "settlement_online") {
    return parseFloat((total - amount).toFixed(2));
  }
  if (transactionType === "settlement_cash") {
    return parseFloat(amount.toFixed(2));
  }
  return 0;
}

// Single resolver used by both endpoints below: prefer the booking's own
// frozen pricing snapshot; fall back to ledger reconstruction only for
// bookings that predate it.
function resolveBookingMoney(booking, walletAmount, transactionType) {
  if (booking?.pricingVersion) {
    return {
      orderAmount: Number(booking.subtotal) || 0,
      taxes: Number(booking.taxAmount) || 0,
      commission: Number(booking.commissionAmount) || 0,
      dealerShare: Number(booking.dealerEarnings) || 0,
    };
  }
  const orderAmount = booking?.totalBill || 0;
  const taxes = booking?.tax || 0;
  const commission = computeCommission(transactionType, walletAmount, orderAmount, taxes);
  const dealerShare = parseFloat((orderAmount - commission).toFixed(2));
  return { orderAmount, taxes, commission, dealerShare };
}

// ─── 1. Transaction List ──────────────────────────────────────────────────────
//
// GET /bikedoctor/finance/transactions
//
// Query params:
//   page             = 1
//   limit            = 20 (max 100)
//   from / to        = ISO date strings, filters on createdAt
//   dealer_id        = Vendor ObjectId
//   booking_id       = Booking ObjectId OR human booking code (e.g. MRB071901)
//   transaction_type = settlement_online | settlement_cash | withdrawal | deposit | manual | reconciliation | rollback
//   status           = ACTIVE | PAID | PENDING | IN_PROGRESS | COMPLETED | FAILED | EXPIRED | APPROVED | REJECTED
//   payment_method   = ONLINE | CASH
//   search           = partial match on dealer name/shop/phone, customer name/phone, orderId, booking code
//   sortBy           = createdAt | amount (default: createdAt)
//   sortOrder        = asc | desc (default: desc)
//
const getTransactionsList = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      from,
      to,
      dealer_id,
      booking_id,
      transaction_type,
      status,
      payment_method,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    if (transaction_type && !TRANSACTION_TYPES.includes(transaction_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid transaction_type. Allowed values: ${TRANSACTION_TYPES.join(", ")}`,
      });
    }
    if (status && !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${ORDER_STATUSES.join(", ")}`,
      });
    }
    if (payment_method && !PAYMENT_METHODS.includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment_method. Allowed values: ${PAYMENT_METHODS.join(", ")}`,
      });
    }

    // ── Base match: fields native to the Wallet document itself ──
    const baseMatch = {};
    if (transaction_type) baseMatch.transaction_type = transaction_type;
    if (status) baseMatch.order_status = status;
    if (dealer_id && mongoose.Types.ObjectId.isValid(dealer_id)) {
      baseMatch.dealer_id = new mongoose.Types.ObjectId(dealer_id);
    }
    if (booking_id && mongoose.Types.ObjectId.isValid(booking_id)) {
      baseMatch.booking_id = new mongoose.Types.ObjectId(booking_id);
    } else if (booking_id) {
      // Not a valid ObjectId — treat as a human booking code (e.g. MRB071901)
      // and resolve it via Booking's own unique `bookingId` index up front,
      // so the Wallet aggregation can filter on the indexed `booking_id`
      // field directly instead of matching "booking.bookingId" after an
      // unconditional $lookup (which can't use any index).
      const matchedBooking = await Booking.findOne({ bookingId: booking_id }).select("_id").lean();
      // No booking matches this code — force an empty result set (a booking_id
      // no document can ever have) rather than matching null/absent booking_id
      // on withdrawal/deposit entries, or silently ignoring the filter.
      baseMatch.booking_id = matchedBooking ? matchedBooking._id : new mongoose.Types.ObjectId("000000000000000000000000");
    }
    if (from || to) {
      baseMatch.createdAt = {};
      if (from) baseMatch.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        baseMatch.createdAt.$lte = toDate;
      }
    }

    // ── Post-lookup match: fields that only exist after joining booking/dealer/customer ──
    const postMatch = {};
    if (payment_method) postMatch.paymentMethod = payment_method;
    if (search) {
      postMatch.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { "dealer.shopName": { $regex: search, $options: "i" } },
        { "dealer.ownerName": { $regex: search, $options: "i" } },
        { "dealer.phone": { $regex: search, $options: "i" } },
        { "booking.bookingId": { $regex: search, $options: "i" } },
        { "customer.first_name": { $regex: search, $options: "i" } },
        { "customer.last_name": { $regex: search, $options: "i" } },
        { "customer.phone": { $regex: search, $options: "i" } },
      ];
    }

    const sortField = sortBy === "amount" ? "Amount" : "createdAt";
    const sortDir = sortOrder === "asc" ? 1 : -1;

    const pipeline = [
      { $match: baseMatch },
      { $lookup: { from: "vendors", localField: "dealer_id", foreignField: "_id", as: "dealer" } },
      { $unwind: { path: "$dealer", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "bookings", localField: "booking_id", foreignField: "_id", as: "booking" } },
      { $unwind: { path: "$booking", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "customers", localField: "booking.user_id", foreignField: "_id", as: "customer" } },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      { $addFields: { paymentMethod: "$booking.payment_method" } },
    ];

    if (Object.keys(postMatch).length > 0) {
      pipeline.push({ $match: postMatch });
    }

    pipeline.push(
      { $sort: { [sortField]: sortDir } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limitNum },
            {
              $project: {
                id: 1,
                orderId: 1,
                Amount: 1,
                Type: 1,
                transaction_type: 1,
                order_status: 1,
                createdAt: 1,
                "dealer._id": 1,
                "dealer.id": 1,
                "dealer.shopName": 1,
                "dealer.ownerName": 1,
                "dealer.phone": 1,
                "dealer.commission": 1,
                "booking._id": 1,
                "booking.bookingId": 1,
                "booking.totalBill": 1,
                "booking.tax": 1,
                "booking.subtotal": 1,
                "booking.taxAmount": 1,
                "booking.commissionAmount": 1,
                "booking.dealerEarnings": 1,
                "booking.pricingVersion": 1,
                "customer._id": 1,
                "customer.first_name": 1,
                "customer.last_name": 1,
                "customer.phone": 1,
                paymentMethod: 1,
              },
            },
          ],
          totalCount: [{ $count: "count" }],
        },
      },
    );

    const [result] = await Wallet.aggregate(pipeline);
    const total = result.totalCount[0]?.count || 0;

    const rows = result.data.map((w) => ({
      _id: w._id,
      transactionId: formatTransactionId(w.id),
      orderId: w.orderId,
      dealer: w.dealer
        ? {
            _id: w.dealer._id,
            dealerId: formatDealerId(w.dealer.id),
            name: w.dealer.shopName || w.dealer.ownerName,
            phone: w.dealer.phone,
          }
        : null,
      booking: w.booking ? { _id: w.booking._id, bookingId: w.booking.bookingId } : null,
      customer: w.customer
        ? { _id: w.customer._id, name: customerName(w.customer), phone: w.customer.phone }
        : null,
      amount: w.Amount,
      commission: resolveBookingMoney(w.booking, w.Amount, w.transaction_type).commission,
      transactionType: w.transaction_type,
      status: w.order_status,
      paymentMethod: w.paymentMethod || null,
      createdAt: w.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("getTransactionsList error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 2. Transaction Details ────────────────────────────────────────────────────
//
// GET /bikedoctor/finance/transactions/:id   (:id = Wallet _id)
//
const getTransactionDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid transaction id" });
    }

    const wallet = await Wallet.findById(id)
      .populate("dealer_id")
      .populate({ path: "booking_id", populate: { path: "user_id" } })
      .lean();

    if (!wallet) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    const dealer = wallet.dealer_id;
    const booking = wallet.booking_id;
    const customer = booking?.user_id;

    // Most recent gateway payment record for this transaction, if any.
    // Booking-linked settlements resolve it via Payment.booking_id; non-booking
    // ledger entries (e.g. WALLET_TOPUP deposits, see controller/payment.js
    // creditDealerWalletOnTopup) have no booking_id at all but share the same
    // orderId with their Payment record, so fall back to that.
    const payment = booking
      ? await Payment.findOne({ booking_id: booking._id }).sort({ createdAt: -1 }).lean()
      : await Payment.findOne({ orderId: wallet.orderId }).sort({ createdAt: -1 }).lean();

    const { orderAmount, taxes, commission, dealerShare } = resolveBookingMoney(
      booking,
      wallet.Amount,
      wallet.transaction_type
    );

    const timeline = [];
    if (booking?.createdAt) {
      timeline.push({ event: "Booking Created", at: booking.createdAt });
    }
    timeline.push({ event: "Transaction Recorded", at: wallet.createdAt });
    if (wallet.updatedAt && String(wallet.updatedAt) !== String(wallet.createdAt)) {
      timeline.push({ event: `Status Updated to ${wallet.order_status}`, at: wallet.updatedAt });
    }
    if (booking?.delivered_at) {
      timeline.push({ event: "Bike Delivered", at: booking.delivered_at });
    }
    timeline.sort((a, b) => new Date(a.at) - new Date(b.at));

    return res.status(200).json({
      success: true,
      data: {
        transactionId: formatTransactionId(wallet.id),
        _id: wallet._id,
        orderId: wallet.orderId,
        transactionType: wallet.transaction_type,
        status: wallet.order_status,
        note: wallet.Note,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,

        bookingDetails: booking
          ? {
              _id: booking._id,
              bookingId: booking.bookingId,
              status: booking.status,
              totalBill: booking.totalBill,
              pickupCharges: booking.pickupCharges || 0,
              dropCharges: booking.dropCharges || 0,
              tax: booking.tax,
              paymentMethod: booking.payment_method,
              serviceSummary: booking.serviceSummary || [],
              scheduleDate: booking.scheduleDate,
              pickupDate: booking.pickupDate,
              deliveredAt: booking.delivered_at,
              createdAt: booking.createdAt,
            }
          : null,

        dealerDetails: dealer
          ? {
              _id: dealer._id,
              dealerId: formatDealerId(dealer.id),
              shopName: dealer.shopName,
              ownerName: dealer.ownerName,
              phone: dealer.phone,
              email: dealer.email || dealer.shopEmail || null,
              commissionRate: dealer.commission || 0,
            }
          : null,

        customerDetails: customer
          ? {
              _id: customer._id,
              name: customerName(customer),
              phone: customer.phone,
              email: customer.email || null,
            }
          : null,

        amountBreakdown: {
          orderAmount,
          platformCommission: commission,
          dealerShare,
          taxes,
          walletAmount: wallet.Amount,
          preBalance: wallet.pre_balance,
          postBalance: wallet.Total,
        },

        paymentGatewayResponse: payment
          ? {
              cf_payment_id: payment.cf_payment_id,
              transaction_id: payment.transaction_id,
              utr_number: payment.utr_number,
              payment_method: payment.payment_method,
              payment_type: payment.payment_type,
              order_status: payment.order_status,
              metadata: payment.metadata || {},
            }
          : null,

        paymentStatus: payment?.order_status || booking?.payment_status || null,

        refundInformation:
          payment && payment.refund_amount > 0
            ? { refundAmount: payment.refund_amount, refundStatus: payment.refund_status }
            : null,

        timeline,
      },
    });
  } catch (error) {
    console.error("getTransactionDetails error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { getTransactionsList, getTransactionDetails };
