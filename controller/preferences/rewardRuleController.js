/**
 * Rewards & Referral Controller (Preferences module)
 *
 * One generic CRUD surface reused for 5 rule types, discriminated by
 * :ruleType in the URL — mirrors the admin frontend's rewardRuleApi.js.
 *
 * Endpoints (mounted at /bikedoctor/preferences/reward-rules):
 *   GET    /:ruleType                  → getRewardRules
 *   GET    /:ruleType/:id              → getRewardRuleById
 *   POST   /:ruleType                  → createRewardRule       (JSON)
 *   PUT    /:ruleType/:id              → updateRewardRule       (JSON)
 *   DELETE /:ruleType/:id              → deleteRewardRule       (soft delete)
 *   PATCH  /:ruleType/:id/status       → toggleRewardRuleStatus body: { status } (boolean)
 *   POST   /:ruleType/bulk-delete      → bulkDeleteRewardRules  body: { ids }
 *   POST   /:ruleType/bulk-status      → bulkUpdateRewardRuleStatus body: { ids, status }
 */

const mongoose = require("mongoose");
const RewardRule = require("../../models/RewardRule");
const { RULE_TYPES } = RewardRule;

// Fields expected per ruleType, matching the field configs in the admin
// frontend's RewardsReferral.jsx so validation stays in sync with the UI.
const FIELDS_BY_TYPE = {
  "referral-bonus": {
    required: ["ruleName", "referrerBonusPoints", "refereeBonusPoints", "minBookingValue", "maxReferralsPerUser"],
    numeric: ["referrerBonusPoints", "refereeBonusPoints", "minBookingValue", "maxReferralsPerUser"],
  },
  "point-rules": {
    required: ["ruleName", "earningBasis", "pointsValue", "applicableService"],
    numeric: ["pointsValue"],
    enums: { earningBasis: ["per_100_spent", "fixed_per_booking"] },
  },
  "redemption-rules": {
    required: ["ruleName", "minPointsToRedeem", "pointValueInRupees", "maxRedemptionPerOrder"],
    numeric: ["minPointsToRedeem", "pointValueInRupees", "maxRedemptionPerOrder"],
  },
  "signup-bonus": {
    required: ["ruleName", "bonusPoints", "bonusValidityDays"],
    numeric: ["bonusPoints", "bonusValidityDays"],
  },
  "cashback-rules": {
    required: ["ruleName", "minOrderValue", "cashbackPercentage", "maxCashback"],
    numeric: ["minOrderValue", "cashbackPercentage", "maxCashback"],
  },
};

function isValidRuleType(ruleType) {
  return RULE_TYPES.includes(ruleType);
}

function validateRulePayload(ruleType, body, { partial = false } = {}) {
  const config = FIELDS_BY_TYPE[ruleType];
  for (const field of config.required) {
    if (partial && body[field] === undefined) continue;
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return `${field} is required`;
    }
  }
  for (const field of config.numeric || []) {
    if (body[field] === undefined) continue;
    if (isNaN(body[field])) return `${field} must be a number`;
  }
  for (const [field, allowed] of Object.entries(config.enums || {})) {
    if (body[field] === undefined) continue;
    if (!allowed.includes(body[field])) return `Invalid ${field}. Allowed: ${allowed.join(", ")}`;
  }
  return null;
}

function buildRuleDoc(ruleType, body) {
  const config = FIELDS_BY_TYPE[ruleType];
  const doc = { ruleType, ruleName: body.ruleName };
  const allFields = [...new Set([...config.required, ...(config.numeric || [])])];
  for (const field of allFields) {
    if (field === "ruleName" || body[field] === undefined) continue;
    doc[field] = (config.numeric || []).includes(field) ? Number(body[field]) : body[field];
  }
  if (body.isActive !== undefined) doc.isActive = Boolean(body.isActive);
  return doc;
}

const getRewardRules = async (req, res) => {
  try {
    const { ruleType } = req.params;
    if (!isValidRuleType(ruleType)) {
      return res.status(400).json({ success: false, message: `Invalid ruleType. Allowed: ${RULE_TYPES.join(", ")}` });
    }
    const { page, limit, search, isActive } = req.query;

    const filter = { ruleType, isDeleted: false };
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (search) filter.ruleName = { $regex: search, $options: "i" };

    if (!page && !limit) {
      const data = await RewardRule.find(filter).sort({ createdAt: -1 }).lean();
      return res.status(200).json({ success: true, data });
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      RewardRule.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      RewardRule.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("getRewardRules error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getRewardRuleById = async (req, res) => {
  try {
    const { ruleType, id } = req.params;
    if (!isValidRuleType(ruleType)) {
      return res.status(400).json({ success: false, message: `Invalid ruleType. Allowed: ${RULE_TYPES.join(", ")}` });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid rule id" });
    }
    const rule = await RewardRule.findOne({ _id: id, ruleType, isDeleted: false }).lean();
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });
    return res.status(200).json({ success: true, data: rule });
  } catch (error) {
    console.error("getRewardRuleById error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const createRewardRule = async (req, res) => {
  try {
    const { ruleType } = req.params;
    if (!isValidRuleType(ruleType)) {
      return res.status(400).json({ success: false, message: `Invalid ruleType. Allowed: ${RULE_TYPES.join(", ")}` });
    }
    const error = validateRulePayload(ruleType, req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const rule = await RewardRule.create(buildRuleDoc(ruleType, req.body));
    return res.status(201).json({ success: true, message: "Rule created successfully", data: rule });
  } catch (error) {
    console.error("createRewardRule error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const updateRewardRule = async (req, res) => {
  try {
    const { ruleType, id } = req.params;
    if (!isValidRuleType(ruleType)) {
      return res.status(400).json({ success: false, message: `Invalid ruleType. Allowed: ${RULE_TYPES.join(", ")}` });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid rule id" });
    }
    const error = validateRulePayload(ruleType, req.body, { partial: true });
    if (error) return res.status(400).json({ success: false, message: error });

    const update = buildRuleDoc(ruleType, req.body);
    delete update.ruleType;
    if (update.ruleName === undefined) delete update.ruleName;

    const rule = await RewardRule.findOneAndUpdate(
      { _id: id, ruleType, isDeleted: false },
      update,
      { new: true }
    );
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });
    return res.status(200).json({ success: true, message: "Rule updated successfully", data: rule });
  } catch (error) {
    console.error("updateRewardRule error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const deleteRewardRule = async (req, res) => {
  try {
    const { ruleType, id } = req.params;
    if (!isValidRuleType(ruleType)) {
      return res.status(400).json({ success: false, message: `Invalid ruleType. Allowed: ${RULE_TYPES.join(", ")}` });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid rule id" });
    }
    const rule = await RewardRule.findOneAndUpdate(
      { _id: id, ruleType, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });
    return res.status(200).json({ success: true, message: "Rule deleted successfully" });
  } catch (error) {
    console.error("deleteRewardRule error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const toggleRewardRuleStatus = async (req, res) => {
  try {
    const { ruleType, id } = req.params;
    const { status } = req.body;
    if (!isValidRuleType(ruleType)) {
      return res.status(400).json({ success: false, message: `Invalid ruleType. Allowed: ${RULE_TYPES.join(", ")}` });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid rule id" });
    }
    if (typeof status !== "boolean") {
      return res.status(400).json({ success: false, message: "status must be a boolean" });
    }
    const rule = await RewardRule.findOneAndUpdate(
      { _id: id, ruleType, isDeleted: false },
      { isActive: status },
      { new: true }
    );
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });
    return res.status(200).json({ success: true, message: "Rule status updated", data: rule });
  } catch (error) {
    console.error("toggleRewardRuleStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const bulkDeleteRewardRules = async (req, res) => {
  try {
    const { ruleType } = req.params;
    const { ids } = req.body;
    if (!isValidRuleType(ruleType)) {
      return res.status(400).json({ success: false, message: `Invalid ruleType. Allowed: ${RULE_TYPES.join(", ")}` });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "ids array is required" });
    }
    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    await RewardRule.updateMany({ _id: { $in: validIds }, ruleType }, { isDeleted: true });
    return res.status(200).json({ success: true, message: "Rules deleted successfully" });
  } catch (error) {
    console.error("bulkDeleteRewardRules error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const bulkUpdateRewardRuleStatus = async (req, res) => {
  try {
    const { ruleType } = req.params;
    const { ids, status } = req.body;
    if (!isValidRuleType(ruleType)) {
      return res.status(400).json({ success: false, message: `Invalid ruleType. Allowed: ${RULE_TYPES.join(", ")}` });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "ids array is required" });
    }
    if (typeof status !== "boolean") {
      return res.status(400).json({ success: false, message: "status must be a boolean" });
    }
    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    await RewardRule.updateMany({ _id: { $in: validIds }, ruleType }, { isActive: status });
    return res.status(200).json({ success: true, message: "Rule statuses updated successfully" });
  } catch (error) {
    console.error("bulkUpdateRewardRuleStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getRewardRules,
  getRewardRuleById,
  createRewardRule,
  updateRewardRule,
  deleteRewardRule,
  toggleRewardRuleStatus,
  bulkDeleteRewardRules,
  bulkUpdateRewardRuleStatus,
};
