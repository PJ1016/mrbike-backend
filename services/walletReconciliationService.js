const mongoose = require("mongoose");
const Vendor = require("../models/dealerModel");
const Wallet = require("../models/Wallet_modal");

const KNOWN_TYPES = ["deposit", "withdrawal", "settlement_online", "settlement_cash", "manual", "reconciliation", "rollback"];

async function reconcileWallets({ page = 1, limit = 20, dealerId, mismatchOnly = false, search } = {}) {
  const match = { isPlayStoreTestAccount: { $ne: true } };
  if (dealerId && mongoose.Types.ObjectId.isValid(dealerId)) match._id = new mongoose.Types.ObjectId(dealerId);
  if (search) match.$or = ["ownerName", "shopName", "phone"].map((field) => ({ [field]: { $regex: search, $options: "i" } }));
  const rows = await Vendor.aggregate([
    { $match: match },
    { $lookup: { from: "wallets", let: { dealerId: "$_id" }, pipeline: [
      { $match: { $expr: { $eq: ["$dealer_id", "$$dealerId"] } } },
      { $group: {
        _id: null,
        ledgerBalance: { $sum: { $switch: { branches: [
          { case: { $eq: ["$Type", "Credit"] }, then: "$Amount" },
          { case: { $eq: ["$Type", "Debit"] }, then: { $multiply: ["$Amount", -1] } },
        ], default: 0 } } },
        transactionCount: { $sum: 1 },
        unknownCount: { $sum: { $cond: [{ $in: ["$transaction_type", KNOWN_TYPES] }, 0, 1] } },
        duplicateOrderIds: { $push: "$orderId" },
      } },
    ], as: "ledger" } },
    { $addFields: { ledger: { $arrayElemAt: ["$ledger", 0] } } },
    { $addFields: { ledgerBalance: { $ifNull: ["$ledger.ledgerBalance", 0] }, transactionCount: { $ifNull: ["$ledger.transactionCount", 0] }, unknownCount: { $ifNull: ["$ledger.unknownCount", 0] } } },
    { $addFields: { difference: { $subtract: ["$wallet", "$ledgerBalance"] } } },
    { $addFields: { duplicateCount: { $subtract: [
      { $size: { $ifNull: ["$ledger.duplicateOrderIds", []] } },
      { $size: { $setUnion: [{ $ifNull: ["$ledger.duplicateOrderIds", []] }, []] } },
    ] } } },
    { $addFields: { reconciliationStatus: { $switch: { branches: [
      { case: { $gt: ["$unknownCount", 0] }, then: "INVALID_TRANSACTION" },
      { case: { $gt: ["$duplicateCount", 0] }, then: "DUPLICATE_LEDGER" },
      { case: { $ne: [{ $round: ["$difference", 2] }, 0] }, then: "MISMATCH" },
      { case: { $and: [{ $ne: ["$wallet", 0] }, { $eq: ["$transactionCount", 0] }] }, then: "MISSING_LEDGER" },
    ], default: "MATCH" } } } },
    ...(mismatchOnly ? [{ $match: { reconciliationStatus: { $ne: "MATCH" } } }] : []),
    { $sort: { reconciliationStatus: 1, shopName: 1 } },
    { $facet: { data: [{ $skip: (Math.max(1, Number(page)) - 1) * Math.min(100, Math.max(1, Number(limit))) }, { $limit: Math.min(100, Math.max(1, Number(limit))) }, { $project: { ownerName: 1, shopName: 1, phone: 1, wallet: 1, ledgerBalance: 1, difference: 1, transactionCount: 1, unknownCount: 1, duplicateCount: 1, reconciliationStatus: 1 } }], totalCount: [{ $count: "count" }] } },
  ]);
  const result = rows[0] || { data: [], totalCount: [] };
  const total = result.totalCount[0]?.count || 0;
  return { data: result.data, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } };
}
module.exports = { reconcileWallets, KNOWN_TYPES };
