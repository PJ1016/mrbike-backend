const BaseAdditionalService = require("../models/baseAdditionalServiceSchema")
const AdditionalService = require("../models/additionalServiceSchema")
const Booking = require("../models/Booking")
const Vendor = require("../models/dealerModel")
const mongoose = require("mongoose")

/**
 * CREATE BaseAdditionalService (Admin Only)
 * POST /base-additional-service
 * Auth: verifyToken middleware on the route
 */
async function createBaseAdditionalService(req, res) {
  try {
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
    const services = await BaseAdditionalService.find({ isActive: { $ne: false } }).sort({ id: -1 })

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
    const { force, deactivate } = req.query

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Valid service ID is required",
      })
    }

    // 0. DEACTIVATE MODE (Soft Delete)
    if (deactivate === "true") {
      console.log(`[v0] Deactivating base additional service ${id} and its associated dealer services.`)
      
      const additionalServiceIds = await AdditionalService.find({ base_additional_service_id: id }).distinct("_id")
      
      // Deactivate BaseAdditionalService
      await BaseAdditionalService.findByIdAndUpdate(id, { isActive: false })
      
      // Deactivate all associated AdditionalServices
      if (additionalServiceIds.length > 0) {
        await AdditionalService.updateMany(
          { _id: { $in: additionalServiceIds } },
          { isActive: false }
        )
      }

      return res.status(200).json({
        status: true,
        message: "Base additional service and associated dealer services deactivated successfully.",
      })
    }

    // 1. Find all AdditionalServices referencing this BaseAdditionalService
    const referencingServices = await AdditionalService.find({
      base_additional_service_id: id,
      isActive: { $ne: false },
    }).populate("dealer_id", "shopName")

    const referencedCount = referencingServices.length

    if (referencedCount > 0) {
      if (force !== "true") {
        return res.status(400).json({
          status: false,
          isReferenced: true,
          message: `Cannot delete this base additional service. It is referenced by ${referencedCount} additional service(s).`,
          referencingDetails: referencingServices.map(as => ({
            additional_service_id: as._id,
            serviceId: as.serviceId,
            dealerName: as.dealer_id?.shopName || "Unknown Dealer",
          })),
          hint: "Use ?force=true to cascadingly delete if NO bookings exist.",
        })
      }

      // 2. FORCE DELETE MODE: Check for Bookings
      const additionalServiceIds = referencingServices.map(as => as._id)
      const bookingCount = await Booking.countDocuments({
        additionalServices: { $in: additionalServiceIds },
      })

      if (bookingCount > 0) {
        return res.status(400).json({
          status: false,
          canDeactivate: true,
          message: `Cannot force delete. There are ${bookingCount} project/booking(s) referencing the associated additional services.`,
          bookingCount,
          hint: "You can use ?deactivate=true to hide this service without breaking booking records.",
        })
      }

      // 3. NO BOOKINGS: Proceed with cascading delete
      console.log(`[v0] Cascadingly deleting base additional service ${id} and ${referencedCount} additional services.`)

      // Delete AdditionalServices
      await AdditionalService.deleteMany({ _id: { $in: additionalServiceIds } })
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
      message: referencedCount > 0 
        ? `Base additional service and ${referencedCount} associated dealer services deleted successfully.` 
        : "Base additional service deleted successfully.",
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
