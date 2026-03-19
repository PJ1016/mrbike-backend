const BaseService = require("../models/baseService")
const AdminService = require("../models/adminService")
const Booking = require("../models/Booking")
const Offer = require("../models/offer_model")
const Vendor = require("../models/dealerModel")
const jwt_decode = require("jwt-decode")
const mongoose = require("mongoose")

/**
 * Helper: Format service with full image URL
 */
function formatServiceResponse(service, req) {
  const serviceObj = service.toObject ? service.toObject() : service
  if (serviceObj.image && !serviceObj.image.startsWith("http")) {
    const protocol = req.protocol
    const host = req.get("host")
    serviceObj.image = `${protocol}://${host}/${serviceObj.image}`
  }
  return serviceObj
}

/**
 * CREATE BaseService (Admin Only)
 * POST /admin/base-services
 */
async function createBaseService(req, res) {
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

    const { name, description } = req.body

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
    const existingService = await BaseService.findOne({
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
       4. Create BaseService
    ========================== */
    const newService = await BaseService.create({
      name: name.trim(),
      description: description?.trim(),
      image: `uploads/base-services/${req.file.filename}`,
    })

    return res.status(201).json({
      status: true,
      message: "Base service created successfully",
      data: formatServiceResponse(newService, req),
    })
  } catch (error) {
    console.error("Error creating base service:", error)
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    })
  }
}

/**
 * LIST BaseServices (Admin Only)
 * GET /admin/base-services
 */
async function listBaseServices(req, res) {
  try {
    const services = await BaseService.find().sort({ id: -1 })

    return res.status(200).json({
      status: true,
      message: services.length > 0 ? "Base services fetched successfully" : "No base services found",
      data: services.map(s => formatServiceResponse(s, req)),
    })
  } catch (error) {
    console.error("Error fetching base services:", error)
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    })
  }
}

/**
 * GET BaseService By ID (Admin Only)
 * GET /admin/base-services/:id
 */
async function getBaseServiceById(req, res) {
  try {
    const { id } = req.params

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Valid service ID is required",
      })
    }

    const service = await BaseService.findById(id)

    if (!service) {
      return res.status(404).json({
        status: false,
        message: "Base service not found",
      })
    }

    return res.status(200).json({
      status: true,
      message: "Base service fetched successfully",
      data: formatServiceResponse(service, req),
    })
  } catch (error) {
    console.error("Error fetching base service:", error)
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    })
  }
}

/**
 * UPDATE BaseService (Admin Only)
 * PUT /admin/base-services/:id
 */
async function updateBaseService(req, res) {
  try {
    const { id } = req.params
    const { name, description } = req.body

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
    const existingService = await BaseService.findOne({
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

    if (description !== undefined) {
      updateData.description = description?.trim()
    }

    if (req.file) {
      updateData.image = `uploads/base-services/${req.file.filename}`
    }

    const updatedService = await BaseService.findByIdAndUpdate(id, updateData, {
      new: true,
    })

    if (!updatedService) {
      return res.status(404).json({
        status: false,
        message: "Base service not found",
      })
    }

    return res.status(200).json({
      status: true,
      message: "Base service updated successfully",
      data: formatServiceResponse(updatedService, req),
    })
  } catch (error) {
    console.error("Error updating base service:", error)
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    })
  }
}

/**
 * DELETE BaseService (Admin Only)
 * DELETE /admin/base-services/:id
 * Prevent deletion if referenced by any AdminService, unless ?force=true and no bookings exist.
 */
async function deleteBaseService(req, res) {
  try {
    const { id } = req.params
    const { force } = req.query

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Valid service ID is required",
      })
    }

    // 1. Find all AdminServices referencing this BaseService
    const referencingAdminServices = await AdminService.find({
      base_service_id: id,
    }).populate("dealer_id", "shopName")

    const referencedCount = referencingAdminServices.length

    if (referencedCount > 0) {
      if (force !== "true") {
        return res.status(400).json({
          status: false,
          isReferenced: true,
          message: `Cannot delete this base service. It is referenced by ${referencedCount} admin service(s).`,
          referencingDetails: referencingAdminServices.map(as => ({
            admin_service_id: as._id,
            serviceId: as.serviceId,
            dealerName: as.dealer_id?.shopName || "Unknown Dealer",
          })),
          hint: "Use ?force=true to cascadingly delete if NO bookings exist.",
        })
      }

      // 2. FORCE DELETE MODE: Check for Bookings
      const adminServiceIds = referencingAdminServices.map(as => as._id)
      const bookingCount = await Booking.countDocuments({
        services: { $in: adminServiceIds },
      })

      if (bookingCount > 0) {
        return res.status(400).json({
          status: false,
          message: `Cannot force delete. There are ${bookingCount} project/booking(s) referencing the associated admin services.`,
          bookingCount,
        })
      }

      // 3. NO BOOKINGS: Proceed with cascading delete
      console.log(`[v0] Cascadingly deleting base service ${id} and ${referencedCount} admin services.`)

      // Clean up Offers
      await Offer.deleteMany({ service_id: { $in: adminServiceIds } })

      // Clean up Vendor (Dealer) services arrays
      await Vendor.updateMany(
        { services: { $in: adminServiceIds } },
        { $pull: { services: { $in: adminServiceIds } } }
      )

      // Delete AdminServices
      await AdminService.deleteMany({ _id: { $in: adminServiceIds } })
    }

    const deletedService = await BaseService.findByIdAndDelete(id)

    if (!deletedService) {
      return res.status(404).json({
        status: false,
        message: "Base service not found",
      })
    }

    return res.status(200).json({
      status: true,
      message: referencedCount > 0 
        ? `Base service and ${referencedCount} associated admin services deleted successfully.` 
        : "Base service deleted successfully.",
    })
  } catch (error) {
    console.error("Error deleting base service:", error)
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    })
  }
}

module.exports = {
  createBaseService,
  listBaseServices,
  getBaseServiceById,
  updateBaseService,
  deleteBaseService,
}
