/**
 * Referral Transactions Controller (Preferences module)
 *
 * Admin-facing, all-users listing of ReferralTransaction records. This is
 * distinct from controller/customers.js's getReferralTransactions, which is
 * customer-facing and scoped to a single req.user_id.
 *
 * Endpoint (mounted at /bikedoctor/preferences/referral-transactions):
 *   GET /   → getReferralTransactions (paginated, admin-only)
 */

const ReferralTransaction = require("../../models/ReferralTransaction");

const getReferralTransactions = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      ReferralTransaction.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: "referrerUserId", select: "first_name last_name" })
        .populate({ path: "referredUserId", select: "first_name last_name" })
        .populate({ path: "bookingId", select: "bookingId" })
        .lean(),
      ReferralTransaction.countDocuments({}),
    ]);

    const data = transactions.map((txn) => ({
      id: txn._id,
      createdDate: txn.createdAt,
      referrerName: `${txn.referrerUserId?.first_name || ""} ${txn.referrerUserId?.last_name || ""}`.trim() || "N/A",
      referredUserName: `${txn.referredUserId?.first_name || ""} ${txn.referredUserId?.last_name || ""}`.trim() || "N/A",
      bookingId: txn.bookingId?.bookingId || null,
      rewardType: txn.rewardType,
      rewardAmount: txn.rewardAmount,
      status: txn.status,
    }));

    return res.status(200).json({
      success: true,
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("getReferralTransactions (admin) error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { getReferralTransactions };
