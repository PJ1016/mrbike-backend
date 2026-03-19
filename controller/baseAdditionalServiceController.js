const BaseAdditionalService = require("../models/baseAdditionalServiceSchema")
const AdditionalService = require("../models/additionalServiceSchema")
const jwt_decode = require("jwt-decode")
const mongoose = require("mongoose")

/**
 * CREATE BaseAdditionalService (Admin Only)
 * POST /admin/base-additional-services
 */
async function createBaseAdditionalService(req, res) {
  try {
    // Auth check
    if (!req.headers.token) {
      return res.status(401).json({
        status: false,
        message: "Token required",
      })
    }

    const data = jwt_decode(req.headers.token)
    const user_id = data.user_id || data.id

    if (!user_id) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized",
      })
    }

    const { name } = req.body

    /* =========================
       1. Validate name
    ========================== */
    if (!name || name.trim() === "") {
      return res.status(400).json({
        status: false,
        message: "Service name is required",
        field: "name",
      })
    }

    /* =========================
       2. Validate image
    ========================== */
    if (!req.file) {
      return res.status(400).json({
        status: false,
        message: "Service image is required",
        field: "image",
      })
    }

    /* =========================
       3. Check if name already exists
    ========================== */
    const existingService = await BaseAdditionalService.findOne({
      name: name.trim(),
    })

    if (existingService) {
      return res.status(400).json({
        status: false,
        message: "Service with this name already exists",
        field: "name",
      })
    }

    /* =========================
       4. Create BaseAdditionalService
    ========================== */
    const newService = await BaseAdditionalService.create({
      name: name.trim(),
      image: req.file.location, // S3 URL
    })

    return res.status(201).json({
      status: true,
      message: "Base additional service created successfully",
      data: newService,
    })
  } catch (error) {
    console.error("Error creating base additional service:", error)
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    })
  }
}

/**
 * LIST BaseAdditionalServices (Admin Only)
 * GET /admin/base-additional-services
 */
async function listBaseAdditionalServices(req, res) {
  try {
    const services = await BaseAdditionalService.find().sort({ id: -1 })

    return res.status(200).json({
      status: true,
      message: services.length > 0 ? "Base additional services fetched successfully" : "No base additional services found",
      data: services,
    })
  } catch (error) {
    console.error("Error fetching base additional services:", error)
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    })
  }
}

/**
 * GET BaseAdditionalService By ID (Admin Only)
 * GET /admin/base-additional-services/:id
 */
async function getBaseAdditionalServiceById(req, res) {
  try {
    const { id } = req.params

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Valid service ID is required",
      })
    }

    const service = await BaseAdditionalService.findById(id)

    if (!service) {
      return res.status(404).json({
        status: false,
        message: "Base additional service not found",
      })
    }

    return res.status(200).json({
      status: true,
      message: "Base additional service fetched successfully",
      data: service,
    })
  } catch (error) {
    console.error("Error fetching base additional service:", error)
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    })
  }
}

/**
 * UPDATE BaseAdditionalService (Admin Only)
 * PUT /admin/base-additional-services/:id
 */
async function updateBaseAdditionalService(req, res) {
  try {
    const { id } = req.params
    const { name } = req.body

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Valid service ID is required",
      })
    }

    if (!name || name.trim() === "") {
      return res.status(400).json({
        status: false,
        message: "Service name is required",
        field: "name",
      })
    }

    // Check if another service has the same name
    const existingService = await BaseAdditionalService.findOne({
      name: name.trim(),
      _id: { $ne: id },
    })

    if (existingService) {
      return res.status(400).json({
        status: false,
        message: "Service with this name already exists",
        field: "name",
      })
    }

    const updateData = {
      name: name.trim(),
    }

    if (req.file) {
      updateData.image = req.file.location // S3 URL
    }

    const updatedService = await BaseAdditionalService.findByIdAndUpdate(id, updateData, {
      new: true,
    })

    if (!updatedService) {
      return res.status(404).json({
        status: false,
        message: "Base additional service not found",
      })
    }

    return res.status(200).json({
      status: true,
      message: "Base additional service updated successfully",
      data: updatedService,
    })
  } catch (error) {
    console.error("Error updating base additional service:", error)
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    })
  }
}

/**
 * DELETE BaseAdditionalService (Admin Only)
 * DELETE /admin/base-additional-services/:id
 * Prevent deletion if referenced by any AdditionalService
 */
async function deleteBaseAdditionalService(req, res) {
  try {
    const { id } = req.params

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Valid service ID is required",
      })
    }

    // Check if any AdditionalService references this BaseAdditionalService
    const referencedCount = await AdditionalService.countDocuments({
      base_additional_service_id: id,
    })

    if (referencedCount > 0) {
      return res.status(400).json({
        status: false,
        message: `Cannot delete this base additional service. It is referenced by ${referencedCount} additional service(s)`,
      })
    }

    const deletedService = await BaseAdditionalService.findByIdAndDelete(id)

    if (!deletedService) {
      return res.status(404).json({
        status: false,
        message: "Base additional service not found",
      })
    }

    return res.status(200).json({
      status: true,
      message: "Base additional service deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting base additional service:", error)
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    })
  }
}

module.exports = {
  createBaseAdditionalService,
  listBaseAdditionalServices,
  getBaseAdditionalServiceById,
  updateBaseAdditionalService,
  deleteBaseAdditionalService,
}
