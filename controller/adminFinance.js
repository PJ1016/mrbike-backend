/**
 * Admin Finance Controller
 *
 * Endpoints:
 *   GET /bikedoctor/dealer/payouts         → getPayouts
 *   GET /bikedoctor/finance/summary        → getFinanceSummary
 *   GET /bikedoctor/dealer/wallets/summary → getDealerWalletsSummary
 */

const mongoose = require("mongoose");
const Wallet = require("../models/Wallet_modal");
const Vendor = require("../models/dealerModel");
const Booking = require("../models/Booking");

// Wallet order_status values that represent a completed/approved payout
const APPROVED_STATUSES = ["COMPLETED", "APPROVED"];

// Build the Wallet.order_status filter for a given UI tab status
function buildWithdrawalStatusFilter(status) {
  if (!status || status === "ALL") return {};
  if (status === "APPROVED") return { order_status: { $in: APPROVED_STATUSES } };
  return { order_status: status };
}

// ─── 1. Payout / Withdrawal Management ───────────────────────────────────────
//
// GET /bikedoctor/dealer/payouts
//
// Query params:
//   status     = ALL | PENDING | IN_PROGRESS | APPROVED | REJECTED  (default: ALL)
//   page       = 1 (default)
//   limit      = 20 (default, max 100)
//   dealer_id  = ObjectId (optional filter)
//   from       = ISO date string (optional)
//   to         = ISO date string (optional)
//
// Response includes:
//   data[]     → payout rows for the requested tab
//   counts     → badge counts for all 4 tabs + ALL (always returned)
//   pagination → page / limit / total / pages
//
const getPayouts = async (req, res) => {
  try {
    const { status = "ALL", page = 1, limit = 20, dealer_id, from, to } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    console.log('[getPayouts] called — status:', status, 'page:', pageNum, 'limit:', limitNum, 'dealer_id:', dealer_id || 'none');

    // Base filter shared by both count and list queries
    const baseFilter = { transaction_type: "withdrawal" };

    if (dealer_id && mongoose.Types.ObjectId.isValid(dealer_id)) {
      baseFilter.dealer_id = new mongoose.Types.ObjectId(dealer_id);
    }

    if (from || to) {
      baseFilter.createdAt = {};
      if (from) baseFilter.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        baseFilter.createdAt.$lte = toDate;
      }
    }

    console.log('[getPayouts] baseFilter:', JSON.stringify(baseFilter));

    // ── Tab badge counts (single aggregation, always across all statuses) ──
    const countsAgg = await Wallet.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: "$order_status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$Amount" },
        },
      },
    ]);

    const counts = {
      ALL: { count: 0, totalAmount: 0 },
      PENDING: { count: 0, totalAmount: 0 },
      IN_PROGRESS: { count: 0, totalAmount: 0 },
      APPROVED: { count: 0, totalAmount: 0 },
      REJECTED: { count: 0, totalAmount: 0 },
    };

    for (const row of countsAgg) {
      counts.ALL.count += row.count;
      counts.ALL.totalAmount += row.totalAmount;

      if (row._id === "PENDING") {
        counts.PENDING.count += row.count;
        counts.PENDING.totalAmount += row.totalAmount;
      } else if (row._id === "IN_PROGRESS") {
        counts.IN_PROGRESS.count += row.count;
        counts.IN_PROGRESS.totalAmount += row.totalAmount;
      } else if (APPROVED_STATUSES.includes(row._id)) {
        // COMPLETED and APPROVED both map to the APPROVED tab
        counts.APPROVED.count += row.count;
        counts.APPROVED.totalAmount += row.totalAmount;
      } else if (row._id === "REJECTED") {
        counts.REJECTED.count += row.count;
        counts.REJECTED.totalAmount += row.totalAmount;
      }
    }

    console.log('[getPayouts] status counts:', JSON.stringify(counts));

    // ── Payout list for the requested tab ──
    const listFilter = { ...baseFilter, ...buildWithdrawalStatusFilter(status) };
    console.log('[getPayouts] listFilter:', JSON.stringify(listFilter));

    const [data, total] = await Promise.all([
      Wallet.find(listFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("dealer_id", "shopName ownerName phone email")
        .lean(),
      Wallet.countDocuments(listFilter),
    ]);

    console.log('[getPayouts] dealer payouts query result', data.length, '/ total:', total);

    const rows = data.map((w) => ({
      _id: w._id,
      orderId: w.orderId,
      dealer: w.dealer_id
        ? {
            _id: w.dealer_id._id,
            name: w.dealer_id.shopName || w.dealer_id.ownerName,
            phone: w.dealer_id.phone,
            email: w.dealer_id.email,
          }
        : null,
      amount: w.Amount,
      // Normalise both COMPLETED and APPROVED to "APPROVED" for the UI
      status: APPROVED_STATUSES.includes(w.order_status) ? "APPROVED" : w.order_status,
      rawStatus: w.order_status,
      note: w.Note,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      data: rows,
      counts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("getPayouts error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 2. Finance Summary ───────────────────────────────────────────────────────
//
// GET /bikedoctor/finance/summary
//
// Runs 5 aggregations in parallel and returns a single summary object.
//
// Commission is derived from settled bookings using the dealer's commission rate
// stored at the time of the booking (Booking.totalBill × Vendor.commission / 100).
//
// totalDealerEarnings = totalBookingValue − totalCommissionEarned − totalTaxCollected
//
const getFinanceSummary = async (req, res) => {
  try {
    const [bookingStats, dealerWalletStats, activeDealers, totalBookings, withdrawalStats] =
      await Promise.all([
        // Booking value / tax / commission – only walletSettled bookings for accuracy
        Booking.aggregate([
          { $match: { walletSettled: true } },
          {
            $lookup: {
              from: "vendors",
              localField: "dealer_id",
              foreignField: "_id",
              as: "dealer",
            },
          },
          { $unwind: { path: "$dealer", preserveNullAndEmpty: false } },
          {
            $group: {
              _id: null,
              totalBookingValue: { $sum: "$totalBill" },
              totalTaxCollected: { $sum: "$tax" },
              totalCommissionEarned: {
                $sum: {
                  $multiply: [
                    "$totalBill",
                    { $divide: [{ $ifNull: ["$dealer.commission", 0] }, 100] },
                  ],
                },
              },
            },
          },
        ]),

        // Live sum of all dealer wallet balances
        Vendor.aggregate([
          { $group: { _id: null, totalWalletBalance: { $sum: "$wallet" } } },
        ]),

        // Active dealers count
        Vendor.countDocuments({ isActive: true }),

        // All-time booking count
        Booking.countDocuments(),

        // Withdrawal breakdown by status
        Wallet.aggregate([
          { $match: { transaction_type: "withdrawal" } },
          {
            $group: {
              _id: "$order_status",
              count: { $sum: 1 },
              totalAmount: { $sum: "$Amount" },
            },
          },
        ]),
      ]);

    const bStats = bookingStats[0] || {
      totalBookingValue: 0,
      totalTaxCollected: 0,
      totalCommissionEarned: 0,
    };

    const totalWalletBalance = dealerWalletStats[0]?.totalWalletBalance ?? 0;

    // Map withdrawal stats into named buckets
    const wBuckets = {
      PENDING: { count: 0, amount: 0 },
      IN_PROGRESS: { count: 0, amount: 0 },
      APPROVED: { count: 0, amount: 0 },
    };
    let totalWithdrawalRequests = 0;

    for (const row of withdrawalStats) {
      totalWithdrawalRequests += row.count;
      if (row._id === "PENDING") {
        wBuckets.PENDING = { count: row.count, amount: parseFloat(row.totalAmount.toFixed(2)) };
      } else if (row._id === "IN_PROGRESS") {
        wBuckets.IN_PROGRESS = { count: row.count, amount: parseFloat(row.totalAmount.toFixed(2)) };
      } else if (APPROVED_STATUSES.includes(row._id)) {
        wBuckets.APPROVED.count += row.count;
        wBuckets.APPROVED.amount = parseFloat((wBuckets.APPROVED.amount + row.totalAmount).toFixed(2));
      }
    }

    const totalBookingValue = parseFloat((bStats.totalBookingValue || 0).toFixed(2));
    const totalTaxCollected = parseFloat((bStats.totalTaxCollected || 0).toFixed(2));
    const totalCommissionEarned = parseFloat((bStats.totalCommissionEarned || 0).toFixed(2));
    const totalDealerEarnings = parseFloat(
      (totalBookingValue - totalCommissionEarned - totalTaxCollected).toFixed(2)
    );

    return res.status(200).json({
      success: true,
      data: {
        totalBookingValue,
        totalCommissionEarned,
        totalTaxCollected,
        totalDealerEarnings,
        totalWalletBalance: parseFloat((totalWalletBalance || 0).toFixed(2)),
        withdrawals: {
          total: totalWithdrawalRequests,
          pending: wBuckets.PENDING,
          inProgress: wBuckets.IN_PROGRESS,
          approved: wBuckets.APPROVED,
        },
        activeDealers,
        totalBookings,
      },
    });
  } catch (error) {
    console.error("getFinanceSummary error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 3. Dealer Wallet Summary ─────────────────────────────────────────────────
//
// GET /bikedoctor/dealer/wallets/summary
//
// Query params:
//   page   = 1
//   limit  = 20 (max 100)
//   search = partial match on shopName / ownerName / phone
//
// Per dealer row:
//   dealerName          shopName or ownerName
//   walletBalance       live Vendor.wallet
//   totalBookingAmount  sum of totalBill for walletSettled bookings
//   totalCommissionPaid totalBookingAmount × commissionRate / 100
//   totalTaxPaid        sum of Booking.tax for walletSettled bookings
//   totalWithdrawals    sum of withdrawal amounts (non-REJECTED, non-FAILED)
//   bookingCount        number of settled bookings
//
const getDealerWalletsSummary = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const matchStage = {};
    if (search) {
      matchStage.$or = [
        { shopName: { $regex: search, $options: "i" } },
        { ownerName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const [dealers, total] = await Promise.all([
      Vendor.aggregate([
        { $match: matchStage },
        { $sort: { shopName: 1 } },
        { $skip: skip },
        { $limit: limitNum },

        // Settled booking stats per dealer
        {
          $lookup: {
            from: "bookings",
            let: { dealerId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$dealer_id", "$$dealerId"] },
                  walletSettled: true,
                },
              },
              {
                $group: {
                  _id: null,
                  totalBookingAmount: { $sum: "$totalBill" },
                  totalTaxPaid: { $sum: "$tax" },
                  bookingCount: { $sum: 1 },
                },
              },
            ],
            as: "bookingStats",
          },
        },

        // Wallet stats per transaction_type (rollbacks and failed entries excluded)
        {
          $lookup: {
            from: "wallets",
            let: { dealerId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$dealer_id", "$$dealerId"] },
                  transaction_type: { $ne: "rollback" },
                  order_status: { $nin: ["REJECTED", "FAILED"] },
                },
              },
              {
                $group: {
                  _id: "$transaction_type",
                  totalAmount: { $sum: "$Amount" },
                },
              },
            ],
            as: "walletStats",
          },
        },

        {
          $project: {
            _id: 1,
            shopName: 1,
            ownerName: 1,
            phone: 1,
            email: 1,
            walletBalance: "$wallet",
            commissionRate: "$commission",
            bookingStats: { $arrayElemAt: ["$bookingStats", 0] },
            walletStats: 1,
          },
        },
      ]),

      Vendor.countDocuments(matchStage),
    ]);

    const rows = dealers.map((d) => {
      const bs = d.bookingStats || {};
      const totalBookingAmount = bs.totalBookingAmount || 0;
      const totalTaxPaid = bs.totalTaxPaid || 0;
      const bookingCount = bs.bookingCount || 0;

      // Commission derived from settled booking totals × dealer rate
      const totalCommissionPaid = parseFloat(
        ((totalBookingAmount * (d.commissionRate || 0)) / 100).toFixed(2)
      );

      // Withdrawal total from wallet ledger
      const wdStat = (d.walletStats || []).find((ws) => ws._id === "withdrawal");
      const totalWithdrawals = parseFloat(((wdStat?.totalAmount) || 0).toFixed(2));

      return {
        _id: d._id,
        dealerName: d.shopName || d.ownerName || "—",
        phone: d.phone,
        email: d.email,
        walletBalance: parseFloat((d.walletBalance || 0).toFixed(2)),
        totalBookingAmount: parseFloat(totalBookingAmount.toFixed(2)),
        totalCommissionPaid,
        totalTaxPaid: parseFloat(totalTaxPaid.toFixed(2)),
        totalWithdrawals,
        bookingCount,
      };
    });

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
    console.error("getDealerWalletsSummary error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { getPayouts, getFinanceSummary, getDealerWalletsSummary };
