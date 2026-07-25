const mongoose = require("mongoose")
const ServiceCategory = require("../../models/serviceCategoryModel")
const BaseService = require("../../models/baseService")

// GET /api/v1/service-categories — public, active only, admin-ordered
async function listActive(req, res) {
  try {
    const categories = await ServiceCategory.find({ isActive: true }).sort({ sortOrder: 1, name: 1 })
    return res.status(200).json({ status: true, message: "Service categories fetched", data: categories })
  } catch (error) {
    console.error("Error fetching service categories:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

// GET /api/v1/admin/service-categories — admin, all (incl. inactive)
async function listAll(req, res) {
  try {
    const categories = await ServiceCategory.find({}).sort({ sortOrder: 1, name: 1 })
    return res.status(200).json({ status: true, message: "Service categories fetched", data: categories })
  } catch (error) {
    console.error("Error fetching service categories:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

async function getById(req, res) {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: false, message: "Invalid category id" })
    }
    const category = await ServiceCategory.findById(id)
    if (!category) {
      return res.status(404).json({ status: false, message: "Service category not found" })
    }
    return res.status(200).json({ status: true, message: "Service category fetched", data: category })
  } catch (error) {
    console.error("Error fetching service category:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

async function create(req, res) {
  try {
    const { name, icon } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ status: false, message: "Category name is required", field: "name" })
    }
    if (!icon || !icon.trim()) {
      return res.status(400).json({ status: false, message: "Category icon is required", field: "icon" })
    }

    const existing = await ServiceCategory.findOne({ name: name.trim() })
    if (existing) {
      return res.status(400).json({ status: false, message: "A category with this name already exists", field: "name" })
    }

    const maxSort = await ServiceCategory.findOne({}).sort({ sortOrder: -1 }).select("sortOrder")
    const category = await ServiceCategory.create({
      name: name.trim(),
      icon: icon.trim(),
      sortOrder: maxSort ? maxSort.sortOrder + 1 : 0,
    })

    return res.status(201).json({ status: true, message: "Service category created", data: category })
  } catch (error) {
    console.error("Error creating service category:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

async function update(req, res) {
  try {
    const { id } = req.params
    const { name, icon } = req.body
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: false, message: "Invalid category id" })
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ status: false, message: "Category name is required", field: "name" })
    }
    if (!icon || !icon.trim()) {
      return res.status(400).json({ status: false, message: "Category icon is required", field: "icon" })
    }

    const existing = await ServiceCategory.findOne({ name: name.trim(), _id: { $ne: id } })
    if (existing) {
      return res.status(400).json({ status: false, message: "A category with this name already exists", field: "name" })
    }

    const updated = await ServiceCategory.findByIdAndUpdate(
      id,
      { name: name.trim(), icon: icon.trim() },
      { new: true },
    )
    if (!updated) {
      return res.status(404).json({ status: false, message: "Service category not found" })
    }
    return res.status(200).json({ status: true, message: "Service category updated", data: updated })
  } catch (error) {
    console.error("Error updating service category:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

async function toggleStatus(req, res) {
  try {
    const { id } = req.params
    const { isActive } = req.body
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: false, message: "Invalid category id" })
    }
    if (typeof isActive !== "boolean") {
      return res.status(400).json({ status: false, message: "isActive (boolean) is required" })
    }
    const updated = await ServiceCategory.findByIdAndUpdate(id, { isActive }, { new: true })
    if (!updated) {
      return res.status(404).json({ status: false, message: "Service category not found" })
    }
    return res.status(200).json({ status: true, message: "Service category status updated", data: updated })
  } catch (error) {
    console.error("Error toggling service category status:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

// PATCH /admin/service-categories/reorder  body: { order: [categoryId, ...] } in the new display order
async function reorder(req, res) {
  try {
    const { order } = req.body
    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ status: false, message: "order (array of category ids) is required" })
    }
    if (order.some(id => !mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ status: false, message: "order contains an invalid category id" })
    }

    await Promise.all(order.map((id, index) => ServiceCategory.findByIdAndUpdate(id, { sortOrder: index })))

    const categories = await ServiceCategory.find({}).sort({ sortOrder: 1, name: 1 })
    return res.status(200).json({ status: true, message: "Service categories reordered", data: categories })
  } catch (error) {
    console.error("Error reordering service categories:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: false, message: "Invalid category id" })
    }

    const inUseCount = await BaseService.countDocuments({ categoryId: id })
    if (inUseCount > 0) {
      return res.status(400).json({
        status: false,
        message: `Cannot delete — ${inUseCount} service(s) are assigned to this category. Reassign or deactivate them first.`,
        inUseCount,
      })
    }

    const deleted = await ServiceCategory.findByIdAndDelete(id)
    if (!deleted) {
      return res.status(404).json({ status: false, message: "Service category not found" })
    }
    return res.status(200).json({ status: true, message: "Service category deleted" })
  } catch (error) {
    console.error("Error deleting service category:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

module.exports = {
  listActive,
  listAll,
  getById,
  create,
  update,
  toggleStatus,
  reorder,
  remove,
}
