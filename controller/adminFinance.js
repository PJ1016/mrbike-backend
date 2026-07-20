/**
 * Admin Finance Controller
 *
 * Endpoints:
 *   GET /bikedoctor/dealer/payouts         → getPayouts
 *   GET /bikedoctor/finance/summary        → getFinanceSummary
 *   GET /bikedoctor/dealer/wallets/summary → getDealerWalletsSummary  (legacy, kept for backward compatibility)
 *   GET /bikedoctor/finance/wallets        → getDealerWallets
 *   GET /bikedoctor/finance/wallets/:id    → getDealerWalletDetails
 */

const mongoose = require("mongoose");
const Wallet = require("../models/Wallet_modal");
const Vendor = require("../models/dealerModel");
const Booking = require("../models/Booking");
const { getDealerStatus, DEALER_STATUSES } = require("../helper/dealerStatus");

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
        .populate("dealer_id", "shopName ownerName phone email id")
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
            dealerId: w.dealer_id.id
              ? `MRBD${w.dealer_id.id.toString().padStart(4, "0")}`
              : null,
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
// Commission/tax/earnings are read directly from each booking's immutable
// pricing snapshot (Booking.subtotal/taxAmount/commissionAmount/dealerEarnings
// — see services/pricingEngine.js), NEVER re-derived from the dealer's
// *current* commission/tax rate. This guarantees historical reports never
// change just because a dealer edited their rates after the fact.
//
// NOTE: bookings settled before this snapshot existed (no pricingVersion)
// report 0 for these fields here — they never had a frozen commissionAmount/
// dealerEarnings to read. Booking.totalBill/tax (legacy mirrors) remain
// populated for them but are intentionally not used in this report anymore.
//
const getFinanceSummary = async (req, res) => {
  console.log('[financeSummary] called');
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    // All 6 cards are computed from 3 collections, one $facet aggregate per
    // collection (Booking / Vendor / Wallet) run concurrently — 3 round trips
    // total instead of the 7 sequential ones this endpoint used to make.
    console.log('[financeSummary] running 3 parallel facet aggregations (booking/vendor/wallet)');
    const [bookingFacets, vendorFacets, walletFacets] = await Promise.all([
      Booking.aggregate([
        {
          $facet: {
            bookingStats: [
              { $match: { walletSettled: true } },
              {
                $group: {
                  _id: null,
                  totalBookingValue: { $sum: "$subtotal" },
                  totalTaxCollected: { $sum: "$taxAmount" },
                  totalCommissionEarned: { $sum: "$commissionAmount" },
                  totalDealerEarnings: { $sum: "$dealerEarnings" },
                },
              },
            ],
            totalBookings: [{ $count: "count" }],
          },
        },
      ]),
      Vendor.aggregate([
        {
          $facet: {
            walletSum: [{ $group: { _id: null, totalWalletBalance: { $sum: "$wallet" } } }],
            activeDealers: [{ $match: { isActive: true } }, { $count: "count" }],
          },
        },
      ]),
      Wallet.aggregate([
        {
          $facet: {
            withdrawalStats: [
              { $match: { transaction_type: "withdrawal" } },
              { $group: { _id: "$order_status", count: { $sum: 1 }, totalAmount: { $sum: "$Amount" } } },
            ],
            todayStats: [
              { $match: { createdAt: { $gte: startOfToday, $lte: endOfToday } } },
              { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: "$Amount" } } },
            ],
            monthStats: [
              { $match: { createdAt: { $gte: startOfMonth, $lte: endOfToday } } },
              { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: "$Amount" } } },
            ],
          },
        },
      ]),
    ]);
    console.log('[financeSummary] facet aggregations complete');

    const bookingStats = bookingFacets[0].bookingStats;
    const totalBookings = bookingFacets[0].totalBookings[0]?.count || 0;
    const totalWalletBalance = vendorFacets[0].walletSum[0]?.totalWalletBalance ?? 0;
    const activeDealers = vendorFacets[0].activeDealers[0]?.count || 0;
    const withdrawalStats = walletFacets[0].withdrawalStats;
    const todayStatsAgg = walletFacets[0].todayStats;
    const monthStatsAgg = walletFacets[0].monthStats;

    const todayTransactions = {
      count: todayStatsAgg[0]?.count || 0,
      totalAmount: parseFloat((todayStatsAgg[0]?.totalAmount || 0).toFixed(2)),
    };
    const thisMonthTransactions = {
      count: monthStatsAgg[0]?.count || 0,
      totalAmount: parseFloat((monthStatsAgg[0]?.totalAmount || 0).toFixed(2)),
    };

    const bStats = bookingStats[0] || {
      totalBookingValue: 0,
      totalTaxCollected: 0,
      totalCommissionEarned: 0,
      totalDealerEarnings: 0,
    };

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
    // Read directly from the stored snapshot — never re-derived by subtraction.
    const totalDealerEarnings = parseFloat((bStats.totalDealerEarnings || 0).toFixed(2));

    console.log('[financeSummary] aggregation complete —', {
      totalBookingValue,
      totalCommissionEarned,
      totalTaxCollected,
      totalDealerEarnings,
      totalWalletBalance,
      withdrawals: wBuckets,
      activeDealers,
      totalBookings,
    });

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
        todayTransactions,
        thisMonthTransactions,
      },
    });
  } catch (error) {
    console.error('[financeSummary] CAUGHT ERROR:', error);
    console.error('[financeSummary] stack:', error.stack);
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
//   totalBookingAmount  sum of Booking.subtotal for walletSettled bookings
//   totalCommissionPaid sum of each booking's own frozen Booking.commissionAmount
//   totalTaxPaid        sum of Booking.taxAmount for walletSettled bookings
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

        // Settled booking stats per dealer — read straight from each
        // booking's immutable pricing snapshot, never Vendor.commission.
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
                  totalBookingAmount: { $sum: "$subtotal" },
                  totalTaxPaid: { $sum: "$taxAmount" },
                  totalCommissionPaid: { $sum: "$commissionAmount" },
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

      // Read directly from each booking's stored commissionAmount snapshot —
      // never re-derived from the dealer's current commission rate.
      const totalCommissionPaid = parseFloat((bs.totalCommissionPaid || 0).toFixed(2));

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

function formatDealerId(numericId) {
  if (!numericId && numericId !== 0) return null;
  return `MRBD${numericId.toString().padStart(4, "0")}`;
}

// Sums a Wallet byType/status facet bucket ([{ _id: { type, status }, totalAmount }])
// down to a single number for the given transaction_type + allowed order_status list.
function sumWalletBucket(byType, type, statuses) {
  if (!Array.isArray(byType)) return 0;
  return byType
    .filter((row) => row._id?.type === type && statuses.includes(row._id?.status))
    .reduce((sum, row) => sum + (row.totalAmount || 0), 0);
}

const SORT_FIELD_MAP = {
  dealerName: "ownerName",
  shopName: "shopName",
  walletBalance: "wallet",
  totalEarnings: "totalEarnings",
  totalWithdrawn: "totalWithdrawn",
  pendingWithdrawalAmount: "pendingWithdrawalAmount",
  lastTransactionDate: "lastTransactionDate",
  createdAt: "createdAt",
};

// ─── 4. Dealer Wallets — List ─────────────────────────────────────────────────
//
// GET /bikedoctor/finance/wallets
//
// Query params:
//   page      = 1
//   limit     = 20 (max 100)
//   search    = partial match on dealer name / shop name / phone
//   status    = one of DEALER_STATUSES (Pending | Pending Documents | Approved |
//               Active | Inactive | Blocked | Rejected) — filters on the dealer's
//               canonical status (there is no separate "wallet status" field;
//               wallet status is the dealer's own operational status).
//   sortBy    = dealerName | shopName | walletBalance | totalEarnings |
//               totalWithdrawn | pendingWithdrawalAmount | lastTransactionDate |
//               createdAt (default: createdAt)
//   sortOrder = asc | desc (default: desc)
//
const getDealerWallets = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    if (status && !DEALER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${DEALER_STATUSES.join(", ")}`,
      });
    }

    const matchStage = {};
    if (search) {
      matchStage.$or = [
        { ownerName: { $regex: search, $options: "i" } },
        { shopName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (status) {
      matchStage.dealerStatus = status;
    }

    const sortField = SORT_FIELD_MAP[sortBy] || "createdAt";
    const sortDir = sortOrder === "asc" ? 1 : -1;

    const [result] = await Vendor.aggregate([
      { $match: matchStage },
      {
        // Read straight from each booking's immutable pricing snapshot —
        // never Vendor.commission — so this report never changes just
        // because a dealer edited their rate after the fact.
        $lookup: {
          from: "bookings",
          let: { dealerId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$dealer_id", "$$dealerId"] }, walletSettled: true } },
            {
              $group: {
                _id: null,
                totalBookingAmount: { $sum: "$subtotal" },
                totalTaxPaid: { $sum: "$taxAmount" },
                totalDealerEarnings: { $sum: "$dealerEarnings" },
                bookingCount: { $sum: 1 },
              },
            },
          ],
          as: "bookingStats",
        },
      },
      {
        $lookup: {
          from: "wallets",
          let: { dealerId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$dealer_id", "$$dealerId"] }, transaction_type: { $ne: "rollback" } } },
            {
              $facet: {
                byType: [
                  { $group: { _id: { type: "$transaction_type", status: "$order_status" }, totalAmount: { $sum: "$Amount" } } },
                ],
                last: [{ $sort: { createdAt: -1 } }, { $limit: 1 }, { $project: { _id: 0, createdAt: 1 } }],
              },
            },
          ],
          as: "walletAgg",
        },
      },
      {
        $addFields: {
          bookingStat: { $arrayElemAt: ["$bookingStats", 0] },
          walletFacet: { $arrayElemAt: ["$walletAgg", 0] },
        },
      },
      {
        $addFields: {
          totalBookingAmount: { $ifNull: ["$bookingStat.totalBookingAmount", 0] },
          totalTaxPaid: { $ifNull: ["$bookingStat.totalTaxPaid", 0] },
          totalDealerEarnings: { $ifNull: ["$bookingStat.totalDealerEarnings", 0] },
          bookingCount: { $ifNull: ["$bookingStat.bookingCount", 0] },
          lastTransactionDate: { $arrayElemAt: ["$walletFacet.last.createdAt", 0] },
          totalWithdrawn: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: { $ifNull: ["$walletFacet.byType", []] },
                    cond: { $and: [{ $eq: ["$$this._id.type", "withdrawal"] }, { $in: ["$$this._id.status", APPROVED_STATUSES] }] },
                  },
                },
                as: "row",
                in: "$$row.totalAmount",
              },
            },
          },
          pendingWithdrawalAmount: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: { $ifNull: ["$walletFacet.byType", []] },
                    cond: { $and: [{ $eq: ["$$this._id.type", "withdrawal"] }, { $in: ["$$this._id.status", ["PENDING", "IN_PROGRESS"]] }] },
                  },
                },
                as: "row",
                in: "$$row.totalAmount",
              },
            },
          },
        },
      },
      {
        // totalEarnings is the sum of each booking's own stored dealerEarnings
        // snapshot — never recomputed from the dealer's current commission rate.
        $addFields: {
          totalEarnings: "$totalDealerEarnings",
        },
      },
      { $sort: { [sortField]: sortDir } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limitNum },
            {
              $project: {
                id: 1,
                ownerName: 1,
                shopName: 1,
                phone: 1,
                wallet: 1,
                totalEarnings: 1,
                totalWithdrawn: 1,
                pendingWithdrawalAmount: 1,
                lastTransactionDate: 1,
                createdAt: 1,
                isBlocked: 1,
                isActive: 1,
                isDoc: 1,
                registrationStatus: 1,
                status: 1,
                dealerStatus: 1,
              },
            },
          ],
          totalCount: [{ $count: "count" }],
        },
      },
    ]);

    const total = result.totalCount[0]?.count || 0;

    const rows = result.data.map((d) => ({
      _id: d._id,
      dealerId: formatDealerId(d.id),
      dealerName: d.ownerName || d.shopName || "—",
      shopName: d.shopName || null,
      phone: d.phone,
      walletBalance: parseFloat((d.wallet || 0).toFixed(2)),
      totalEarnings: parseFloat((d.totalEarnings || 0).toFixed(2)),
      totalWithdrawn: parseFloat((d.totalWithdrawn || 0).toFixed(2)),
      pendingWithdrawalAmount: parseFloat((d.pendingWithdrawalAmount || 0).toFixed(2)),
      lastTransactionDate: d.lastTransactionDate || null,
      walletStatus: getDealerStatus(d),
      createdDate: d.createdAt,
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
    console.error("getDealerWallets error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 5. Dealer Wallet — Details ───────────────────────────────────────────────
//
// GET /bikedoctor/finance/wallets/:id   (:id = Vendor _id)
//
// Query params:
//   recentLimit      = 10 (recent transactions, max 50)
//   withdrawalPage   = 1
//   withdrawalLimit  = 10 (max 100)
//
const getDealerWalletDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid dealer id" });
    }

    const dealer = await Vendor.findById(id).lean();
    if (!dealer) {
      return res.status(404).json({ success: false, message: "Dealer not found" });
    }

    const recentLimit = Math.min(50, Math.max(1, parseInt(req.query.recentLimit) || 10));
    const withdrawalPage = Math.max(1, parseInt(req.query.withdrawalPage) || 1);
    const withdrawalLimit = Math.min(100, Math.max(1, parseInt(req.query.withdrawalLimit) || 10));
    const withdrawalSkip = (withdrawalPage - 1) * withdrawalLimit;

    const dealerObjectId = new mongoose.Types.ObjectId(id);

    const [bookingStats, walletBuckets, recentTransactions, withdrawalData, withdrawalTotal] = await Promise.all([
      Booking.aggregate([
        { $match: { dealer_id: dealerObjectId, walletSettled: true } },
        {
          $group: {
            _id: null,
            totalBookingAmount: { $sum: "$subtotal" },
            totalTaxPaid: { $sum: "$taxAmount" },
            totalCommissionPaid: { $sum: "$commissionAmount" },
            totalDealerEarnings: { $sum: "$dealerEarnings" },
            bookingCount: { $sum: 1 },
          },
        },
      ]),
      Wallet.aggregate([
        { $match: { dealer_id: dealerObjectId, transaction_type: { $ne: "rollback" } } },
        { $group: { _id: { type: "$transaction_type", status: "$order_status" }, totalAmount: { $sum: "$Amount" } } },
      ]),
      Wallet.find({ dealer_id: dealerObjectId })
        .sort({ createdAt: -1 })
        .limit(recentLimit)
        .populate("booking_id", "bookingId totalBill tax")
        .lean(),
      Wallet.find({ dealer_id: dealerObjectId, transaction_type: "withdrawal" })
        .sort({ createdAt: -1 })
        .skip(withdrawalSkip)
        .limit(withdrawalLimit)
        .populate("booking_id", "bookingId")
        .lean(),
      Wallet.countDocuments({ dealer_id: dealerObjectId, transaction_type: "withdrawal" }),
    ]);

    const bStats = bookingStats[0] || {
      totalBookingAmount: 0,
      totalTaxPaid: 0,
      totalCommissionPaid: 0,
      totalDealerEarnings: 0,
      bookingCount: 0,
    };
    const totalBookingAmount = bStats.totalBookingAmount || 0;
    const totalTaxPaid = bStats.totalTaxPaid || 0;
    // dealer.commission is shown to the admin as the dealer's *current* rate
    // (display only) — the actual paid/earnings totals below come from each
    // booking's own frozen snapshot, never this current rate.
    const commissionRate = dealer.commission || 0;
    const totalCommissionPaid = parseFloat((bStats.totalCommissionPaid || 0).toFixed(2));
    const lifetimeEarnings = parseFloat((bStats.totalDealerEarnings || 0).toFixed(2));

    const totalWithdrawals = sumWalletBucket(walletBuckets, "withdrawal", APPROVED_STATUSES);
    const pendingBalance = sumWalletBucket(walletBuckets, "withdrawal", ["PENDING", "IN_PROGRESS"]);

    const mapTxn = (w) => ({
      _id: w._id,
      transactionId: `TXN${(w.id || 0).toString().padStart(6, "0")}`,
      amount: w.Amount,
      type: w.Type,
      transactionType: w.transaction_type,
      status: w.order_status,
      note: w.Note,
      booking: w.booking_id ? { _id: w.booking_id._id, bookingId: w.booking_id.bookingId } : null,
      createdAt: w.createdAt,
    });

    return res.status(200).json({
      success: true,
      data: {
        dealer: {
          _id: dealer._id,
          dealerId: formatDealerId(dealer.id),
          dealerName: dealer.ownerName || dealer.shopName || "—",
          shopName: dealer.shopName || null,
          phone: dealer.phone,
          email: dealer.email || dealer.shopEmail || null,
          commissionRate,
          walletStatus: getDealerStatus(dealer),
          createdDate: dealer.createdAt,
        },
        walletSummary: {
          availableBalance: parseFloat((dealer.wallet || 0).toFixed(2)),
          pendingBalance: parseFloat(pendingBalance.toFixed(2)),
          lifetimeEarnings,
          totalWithdrawals: parseFloat(totalWithdrawals.toFixed(2)),
        },
        recentTransactions: recentTransactions.map(mapTxn),
        withdrawalHistory: {
          data: withdrawalData.map(mapTxn),
          pagination: {
            page: withdrawalPage,
            limit: withdrawalLimit,
            total: withdrawalTotal,
            pages: Math.ceil(withdrawalTotal / withdrawalLimit),
          },
        },
      },
    });
  } catch (error) {
    console.error("getDealerWalletDetails error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getPayouts,
  getFinanceSummary,
  getDealerWalletsSummary,
  getDealerWallets,
  getDealerWalletDetails,
};
