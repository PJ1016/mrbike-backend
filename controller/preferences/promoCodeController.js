/**
 * Promo Codes Controller (Preferences module)
 *
 * Endpoints (mounted at /bikedoctor/preferences/promo-codes):
 *   GET    /                  → getPromoCodes
 *   GET    /generate-code     → generateCode           (promo code generator helper)
 *   GET    /:id                → getPromoCodeById
 *   POST   /                  → createPromoCode        (JSON)
 *   PUT    /:id                → updatePromoCode        (JSON)
 *   DELETE /:id                → deletePromoCode        (soft delete)
 *   PATCH  /:id/status         → togglePromoCodeStatus  body: { status } (boolean isActive)
 *   POST   /bulk-delete        → bulkDeletePromoCodes   body: { ids }
 *   POST   /bulk-status        → bulkUpdatePromoCodeStatus body: { ids, status }
 *
 * Usage tracking: each redemption is recorded in the PromoCodeUsage
 * collection (promoCode, user_id, booking_id, discountApplied) by
 * services/invoiceService.js#getOrCreateInvoice — the single choke point
 * every "booking successfully paid" path funnels through. `usedCount` on
 * the PromoCode document is the running aggregate shown here.
 */

const mongoose = require("mongoose");
const PromoCode = require("../../models/PromoCode");
const { DISCOUNT_TYPES } = PromoCode;
const { generatePromoCode } = require("../../utils/promoCodeGenerator");

const getPromoCodes = async (req, res) => {
  try {
    const { page, limit, search, isActive, discountType } = req.query;

    const filter = { isDeleted: false };
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (discountType) filter.discountType = discountType;
    if (search) filter.code = { $regex: search, $options: "i" };

    if (!page && !limit) {
      const data = await PromoCode.find(filter).sort({ createdAt: -1 }).lean();
      return res.status(200).json({ success: true, data });
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      PromoCode.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      PromoCode.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("getPromoCodes error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const generateCode = async (req, res) => {
  try {
    let code;
    let attempts = 0;
    do {
      code = generatePromoCode();
      attempts += 1;
    } while (attempts < 5 && (await PromoCode.exists({ code })));
    return res.status(200).json({ success: true, data: { code } });
  } catch (error) {
    console.error("generateCode error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getPromoCodeById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid promo code id" });
    }
    const promoCode = await PromoCode.findOne({ _id: id, isDeleted: false }).lean();
    if (!promoCode) return res.status(404).json({ success: false, message: "Promo code not found" });
    return res.status(200).json({ success: true, data: promoCode });
  } catch (error) {
    console.error("getPromoCodeById error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

function validatePromoCodeInput(body, { partial = false } = {}) {
  const { code, name, discountType, discountValue, usageLimit, perUserLimit, validFrom, validTo } = body;

  if (!partial || code !== undefined) {
    if (!code || !String(code).trim()) return "Promo code is required";
  }
  if (!partial || name !== undefined) {
    if (!name || !String(name).trim()) return "Promo name is required";
  }
  if (!partial || discountType !== undefined) {
    if (!discountType || !DISCOUNT_TYPES.includes(discountType)) {
      return `Invalid discountType. Allowed: ${DISCOUNT_TYPES.join(", ")}`;
    }
  }
  if (!partial || discountValue !== undefined) {
    if (discountValue === undefined || discountValue === null || isNaN(discountValue) || Number(discountValue) < 0) {
      return "Valid discountValue is required";
    }
  }
  if (!partial || usageLimit !== undefined) {
    if (usageLimit === undefined || usageLimit === null || isNaN(usageLimit) || Number(usageLimit) < 1) {
      return "Valid usageLimit is required";
    }
  }
  if (!partial || perUserLimit !== undefined) {
    if (perUserLimit === undefined || perUserLimit === null || isNaN(perUserLimit) || Number(perUserLimit) < 1) {
      return "Valid perUserLimit is required";
    }
  }
  if (!partial || validFrom !== undefined) {
    if (!validFrom || isNaN(new Date(validFrom).getTime())) return "Valid validFrom date is required";
  }
  if (!partial || validTo !== undefined) {
    if (!validTo || isNaN(new Date(validTo).getTime())) return "Valid validTo date is required";
  }
  if (validFrom && validTo && new Date(validFrom) > new Date(validTo)) {
    return "validFrom must be before validTo";
  }
  return null;
}

const createPromoCode = async (req, res) => {
  try {
    const error = validatePromoCodeInput(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const { code, name, description, discountType, discountValue, maxDiscount, minOrder, usageLimit, perUserLimit, validFrom, validTo, isActive } = req.body;

    const normalizedCode = String(code).trim().toUpperCase().replace(/\s+/g, "");
    const existing = await PromoCode.findOne({ code: normalizedCode, isDeleted: false });
    if (existing) return res.status(409).json({ success: false, message: "Promo code already exists" });

    const promoCode = await PromoCode.create({
      code: normalizedCode,
      name: String(name).trim(),
      description: description ? String(description).trim() : "",
      discountType,
      discountValue: Number(discountValue),
      maxDiscount: maxDiscount === undefined || maxDiscount === null || maxDiscount === "" ? null : Number(maxDiscount),
      minOrder: minOrder === undefined || minOrder === null || minOrder === "" ? null : Number(minOrder),
      usageLimit: Number(usageLimit),
      perUserLimit: Number(perUserLimit),
      validFrom: new Date(validFrom),
      validTo: new Date(validTo),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    return res.status(201).json({ success: true, message: "Promo code created successfully", data: promoCode });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Promo code already exists" });
    }
    console.error("createPromoCode error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const updatePromoCode = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid promo code id" });
    }
    const promoCode = await PromoCode.findOne({ _id: id, isDeleted: false });
    if (!promoCode) return res.status(404).json({ success: false, message: "Promo code not found" });

    const error = validatePromoCodeInput(req.body, { partial: true });
    if (error) return res.status(400).json({ success: false, message: error });

    const { code, name, description, discountType, discountValue, maxDiscount, minOrder, usageLimit, perUserLimit, validFrom, validTo, isActive } = req.body;

    if (code !== undefined) {
      const normalizedCode = String(code).trim().toUpperCase().replace(/\s+/g, "");
      if (normalizedCode !== promoCode.code) {
        const existing = await PromoCode.findOne({ code: normalizedCode, isDeleted: false, _id: { $ne: id } });
        if (existing) return res.status(409).json({ success: false, message: "Promo code already exists" });
        promoCode.code = normalizedCode;
      }
    }
    if (name !== undefined) promoCode.name = String(name).trim();
    if (description !== undefined) promoCode.description = String(description).trim();
    if (discountType !== undefined) promoCode.discountType = discountType;
    if (discountValue !== undefined) promoCode.discountValue = Number(discountValue);
    if (maxDiscount !== undefined) promoCode.maxDiscount = maxDiscount === null || maxDiscount === "" ? null : Number(maxDiscount);
    if (minOrder !== undefined) promoCode.minOrder = minOrder === null || minOrder === "" ? null : Number(minOrder);
    if (usageLimit !== undefined) promoCode.usageLimit = Number(usageLimit);
    if (perUserLimit !== undefined) promoCode.perUserLimit = Number(perUserLimit);
    if (validFrom !== undefined) promoCode.validFrom = new Date(validFrom);
    if (validTo !== undefined) promoCode.validTo = new Date(validTo);
    if (isActive !== undefined) promoCode.isActive = Boolean(isActive);

    await promoCode.save();
    return res.status(200).json({ success: true, message: "Promo code updated successfully", data: promoCode });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Promo code already exists" });
    }
    console.error("updatePromoCode error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const deletePromoCode = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid promo code id" });
    }
    const promoCode = await PromoCode.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    if (!promoCode) return res.status(404).json({ success: false, message: "Promo code not found" });
    return res.status(200).json({ success: true, message: "Promo code deleted successfully" });
  } catch (error) {
    console.error("deletePromoCode error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const togglePromoCodeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid promo code id" });
    }
    if (typeof status !== "boolean") {
      return res.status(400).json({ success: false, message: "status must be a boolean" });
    }
    const promoCode = await PromoCode.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { isActive: status },
      { new: true }
    );
    if (!promoCode) return res.status(404).json({ success: false, message: "Promo code not found" });
    return res.status(200).json({ success: true, message: "Promo code status updated", data: promoCode });
  } catch (error) {
    console.error("togglePromoCodeStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const bulkDeletePromoCodes = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "ids array is required" });
    }
    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    await PromoCode.updateMany({ _id: { $in: validIds } }, { isDeleted: true });
    return res.status(200).json({ success: true, message: "Promo codes deleted successfully" });
  } catch (error) {
    console.error("bulkDeletePromoCodes error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const bulkUpdatePromoCodeStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "ids array is required" });
    }
    if (typeof status !== "boolean") {
      return res.status(400).json({ success: false, message: "status must be a boolean" });
    }
    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    await PromoCode.updateMany({ _id: { $in: validIds } }, { isActive: status });
    return res.status(200).json({ success: true, message: "Promo code statuses updated successfully" });
  } catch (error) {
    console.error("bulkUpdatePromoCodeStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getPromoCodes,
  generateCode,
  getPromoCodeById,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  togglePromoCodeStatus,
  bulkDeletePromoCodes,
  bulkUpdatePromoCodeStatus,
};
