/**
 * App Content — FAQ Controller (Preferences module)
 *
 * Endpoints (mounted at /bikedoctor/preferences/faq):
 *   GET    /               → getFaqs
 *   POST   /               → createFaq       (JSON)
 *   PUT    /:id            → updateFaq       (JSON)
 *   DELETE /:id            → deleteFaq       (soft delete)
 *   PATCH  /:id/status     → toggleFaqStatus body: { status } (boolean)
 *   POST   /bulk-delete    → bulkDeleteFaqs  body: { ids }
 */

const mongoose = require("mongoose");
const Faq = require("../../models/Faq");

const getFaqs = async (req, res) => {
  try {
    const { page, limit, search, category, isActive } = req.query;
    const filter = { isDeleted: false };
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (search) {
      filter.$or = [
        { question: { $regex: search, $options: "i" } },
        { answer: { $regex: search, $options: "i" } },
      ];
    }

    if (!page && !limit) {
      const data = await Faq.find(filter).sort({ displayOrder: 1, createdAt: -1 }).lean();
      return res.status(200).json({ success: true, data });
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [data, total] = await Promise.all([
      Faq.find(filter).sort({ displayOrder: 1, createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Faq.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    console.error("getFaqs error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const createFaq = async (req, res) => {
  try {
    const { question, answer, category, displayOrder, isActive } = req.body;
    if (!question || !question.trim()) return res.status(400).json({ success: false, message: "Question is required" });
    if (!answer || !answer.trim()) return res.status(400).json({ success: false, message: "Answer is required" });

    const faq = await Faq.create({
      question: question.trim(),
      answer,
      category: category || "General",
      displayOrder: displayOrder !== undefined ? Number(displayOrder) : 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    return res.status(201).json({ success: true, message: "FAQ created successfully", data: faq });
  } catch (error) {
    console.error("createFaq error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const updateFaq = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid FAQ id" });
    }
    const faq = await Faq.findOne({ _id: id, isDeleted: false });
    if (!faq) return res.status(404).json({ success: false, message: "FAQ not found" });

    const { question, answer, category, displayOrder, isActive } = req.body;
    if (question !== undefined) faq.question = question.trim();
    if (answer !== undefined) faq.answer = answer;
    if (category !== undefined) faq.category = category;
    if (displayOrder !== undefined) faq.displayOrder = Number(displayOrder);
    if (isActive !== undefined) faq.isActive = Boolean(isActive);

    await faq.save();
    return res.status(200).json({ success: true, message: "FAQ updated successfully", data: faq });
  } catch (error) {
    console.error("updateFaq error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const deleteFaq = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid FAQ id" });
    }
    const faq = await Faq.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true }, { new: true });
    if (!faq) return res.status(404).json({ success: false, message: "FAQ not found" });
    return res.status(200).json({ success: true, message: "FAQ deleted successfully" });
  } catch (error) {
    console.error("deleteFaq error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const toggleFaqStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid FAQ id" });
    }
    if (typeof status !== "boolean") {
      return res.status(400).json({ success: false, message: "status must be a boolean" });
    }
    const faq = await Faq.findOneAndUpdate({ _id: id, isDeleted: false }, { isActive: status }, { new: true });
    if (!faq) return res.status(404).json({ success: false, message: "FAQ not found" });
    return res.status(200).json({ success: true, message: "FAQ status updated", data: faq });
  } catch (error) {
    console.error("toggleFaqStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const bulkDeleteFaqs = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "ids array is required" });
    }
    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    await Faq.updateMany({ _id: { $in: validIds } }, { isDeleted: true });
    return res.status(200).json({ success: true, message: "FAQs deleted successfully" });
  } catch (error) {
    console.error("bulkDeleteFaqs error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { getFaqs, createFaq, updateFaq, deleteFaq, toggleFaqStatus, bulkDeleteFaqs };
