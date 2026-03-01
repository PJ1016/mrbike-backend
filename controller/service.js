const service = require("../models/service_model")
const additionalService = require("../models/additionalServiceSchema")
const jwt_decode = require("jwt-decode")
const adminservices = require("../models/adminService")
const mongoose = require("mongoose")
const BaseService = require("../models/baseService")

async function servicelist(req, res) {
  try {
    const services = await service.find().populate("dealer_id", "shopName email").sort({ id: -1 })

    return res.status(200).send({
      status: 200,
      message: services.length > 0 ? "Success" : "No services available",
      data: services,
    })
  } catch (error) {
    console.error("Error fetching services:", error)
    return res.status(200).send({ status: 500, message: "Internal Server Error" })
  }
}

async function singleService(req, res) {
  try {
    const { id } = req.params
    if (!id) {
      return res.status(200).send({ status: 400, message: "Service ID is required!" })
    }

    const serviceData = await service.findById(id).populate("dealer_id", "name email")
    return res.status(200).send({
      status: 200,
      message: serviceData ? "Success" : "Service not found!",
      data: serviceData || {},
    })
  } catch (error) {
    console.error("Error fetching service:", error)
    return res.status(200).send({ status: 500, message: "Internal Server Error" })
  }
}

async function updateService(req, res) {
  try {
    const { service_id, name, description, dealer_id, bikes } = req.body
    if (!service_id || !name || !dealer_id) {
      return res.status(200).send({ status: 400, message: "Service ID, name, and dealer ID are required!" })
    }

    let parsedBikes = []
    if (bikes) {
      try {
        parsedBikes = JSON.parse(bikes)
      } catch (error) {
        return res.status(200).send({ status: 400, message: "Invalid bikes data format!" })
      }
    }

    const updateData = { name, description, dealer_id }
    if (req.file) {
      updateData.image = `uploads/services/${req.file.filename}`
    }

    if (parsedBikes.length > 0) {
      updateData.bikes = parsedBikes
    }

    const updatedService = await service.findByIdAndUpdate(service_id, updateData, { new: true })
    return res.status(200).send({
      status: 200,
      message: updatedService ? "Service updated successfully" : "Service not found!",
      data: updatedService || {},
    })
  } catch (error) {
    console.error("Error updating service:", error)
    return res.status(200).send({ status: 500, message: "Internal Server Error" })
  }
}

async function deleteService(req, res) {
  try {
    const { service_id } = req.body
    if (!service_id) {
      return res.status(200).send({ status: 400, message: "Service ID is required!" })
    }

    const deletedService = await service.findByIdAndDelete(service_id)
    return res.status(200).send({
      status: 200,
      message: deletedService ? "Service deleted successfully" : "Service not found!",
    })
  } catch (error) {
    console.error("Error deleting service:", error)
    return res.status(200).send({ status: 500, message: "Internal Server Error" })
  }
}

/**
 * UPDATED: Fetch admin services for a specific dealer
 * Now queries adminservices model where dealer_id is in the dealers array
 * GET /service/dealer/:dealer_id
 */
async function getServicesByDealer(req, res) {
  try {
    const { dealer_id } = req.params

    if (!dealer_id || !mongoose.Types.ObjectId.isValid(dealer_id)) {
      return res.status(200).send({
        status: 400,
        message: "Valid dealer ID is required!",
      })
    }

    console.log("[v0] Fetching admin services for dealer:", dealer_id)

    // Query adminservices where this dealer is in the dealers array
    const services = await adminservices
      .find({
        dealers: dealer_id,
      })
      .populate("base_service_id", "name image")
      .populate("companies", "name")
      .populate({
        path: "bikes.model_id",
        select: "model_name",
      })
      .populate({
        path: "bikes.variant_id",
        select: "variant_name",
      })
      .sort({ createdAt: -1 })

    console.log("[v0] Found services:", services.length)

    // Format response with service details and pricing
    const formattedServices = services.map((service) => ({
      _id: service._id,
      serviceId: service.serviceId || null,
      name: service.base_service_id?.name,
      image: service.base_service_id?.image,
      companies: service.companies,
      bikes: service.bikes,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    }))

    return res.status(200).send({
      status: 200,
      message:
        formattedServices.length > 0
          ? "Success"
          : "No services found for this dealer",
      data: formattedServices,
    })
  } catch (error) {
    console.error("Error fetching services by dealer:", error)
    return res.status(200).send({
      status: 500,
      message: "Internal Server Error",
    })
  }
}

/**
 * REFACTORED: addAdminService - now uses base_service_id instead of name/image
 */
async function addAdminService(req, res) {
  try {
    // Auth check
    if (!req.headers.token) {
      return res.status(401).json({
        status: false,
        message: "Token required",
      })
    }

    const data = jwt_decode(req.headers.token)
    const { id, role } = data

    // Check if user is admin
    if (!id || role !== "Admin") {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - Admin access required",
      })
    }

    const { base_service_id, companies, bikes, dealer_id, description } = req.body

    /* =========================
       1. Validate base_service_id
    ========================== */
    if (!base_service_id || !mongoose.Types.ObjectId.isValid(base_service_id)) {
      return res.status(400).json({
        status: false,
        message: "Valid base_service_id is required",
        field: "base_service_id",
      })
    }

    // Check if BaseService exists
    const baseService = await BaseService.findById(base_service_id)
    if (!baseService) {
      return res.status(404).json({
        status: false,
        message: "Base service not found",
        field: "base_service_id",
      })
    }

    if (!dealer_id || !mongoose.Types.ObjectId.isValid(dealer_id)) {
      return res.status(400).json({
        status: false,
        message: "Valid dealer_id is required",
        field: "dealer_id",
      })
    }

    /* =========================
       2. Validate companies
    ========================== */
    let parsedCompanies = []
    try {
      parsedCompanies = typeof companies === "string" ? JSON.parse(companies) : companies
    } catch {
      return res.status(400).json({
        status: false,
        message: "Invalid companies format",
        field: "companies",
      })
    }

    if (!Array.isArray(parsedCompanies) || parsedCompanies.length === 0) {
      return res.status(400).json({
        status: false,
        message: "At least one company is required",
        field: "companies",
      })
    }

    for (let i = 0; i < parsedCompanies.length; i++) {
      if (!mongoose.Types.ObjectId.isValid(parsedCompanies[i])) {
        return res.status(400).json({
          status: false,
          message: `Invalid companyId at index ${i}`,
          field: `companies[${i}]`,
        })
      }
    }

    /* =========================
       3. Validate CC-wise pricing
    ========================== */
    let parsedBikes = []
    try {
      parsedBikes = typeof bikes === "string" ? JSON.parse(bikes) : bikes
    } catch {
      return res.status(400).json({
        status: false,
        message: "Invalid bikes format",
        field: "bikes",
      })
    }

    if (!Array.isArray(parsedBikes) || parsedBikes.length === 0) {
      return res.status(400).json({
        status: false,
        message: "At least one CC price is required",
        field: "bikes",
      })
    }

    for (let i = 0; i < parsedBikes.length; i++) {
      const { cc, price, model_id, variant_id } = parsedBikes[i]

      if (model_id && !mongoose.Types.ObjectId.isValid(model_id)) {
        return res.status(400).json({
          status: false,
          message: `Invalid modelId at index ${i}`,
          field: `bikes[${i}].model_id`,
        })
      }

      if (variant_id && !mongoose.Types.ObjectId.isValid(variant_id)) {
        return res.status(400).json({
          status: false,
          message: `Invalid variantId at index ${i}`,
          field: `bikes[${i}].variant_id`,
        })
      }

      if (!cc || isNaN(cc) || cc <= 0) {
        return res.status(400).json({
          status: false,
          message: `Invalid CC at index ${i}`,
          field: `bikes[${i}].cc`,
        })
      }

      if (!price || isNaN(price) || price <= 0) {
        return res.status(400).json({
          status: false,
          message: `Invalid price at index ${i}`,
          field: `bikes[${i}].price`,
        })
      }
    }

    /* =========================
       4. Create admin service
    ========================== */
    const newService = await adminservices.create({
      base_service_id,
      companies: parsedCompanies,
      dealer_id,
      bikes: parsedBikes,
      description: description || "",
    })

    return res.status(201).json({
      status: true,
      message: "Admin service created successfully",
      data: newService,
    })
  } catch (error) {
    console.error("Error adding admin service:", error)
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    })
  }
}

/**
 * UPDATED: listAdminServices - populates dealer name and dealerId (shortId)
 */
async function listAdminServices(req, res) {
  try {
    const services = await adminservices
      .find()
      .populate("base_service_id", "name image")
      .populate("companies", "name")
      .populate("dealer_id", "shopName id")
      .sort({ id: -1 })

    return res.status(200).json({
      status: true,
      message: services.length ? "Admin services fetched successfully" : "No admin services found",
      data: services,
    })
  } catch (error) {
    console.error("Error fetching admin services:", error)
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    })
  }
}

/**
 * REFACTORED: getAdminServiceById - now populates base_service_id
 */
async function getAdminServiceById(req, res) {
  try {
    const { id } = req.params

    const service = await adminservices
      .findById(id)
      .populate("base_service_id", "name image")
      .populate("companies", "name")
      .populate("dealer_id", "shopName id")
      .populate({
        path: "bikes.model_id",
        select: "model_name",
      })
      .populate({
        path: "bikes.variant_id",
        select: "variant_name",
      })

    if (!service) {
      return res.status(404).json({
        status: false,
        message: "Admin service not found",
      })
    }

    return res.status(200).json({
      status: true,
      message: "Admin service fetched successfully",
      data: service,
    })
  } catch (error) {
    console.error("Error fetching admin service by id:", error)
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    })
  }
}

/**
 * REFACTORED: updateAdminService - Now allows full updates like CREATE
 */
async function updateAdminService(req, res) {
  try {
    // Auth check
    if (!req.headers.token) {
      return res.status(401).json({
        status: false,
        message: "Token required",
      })
    }

    const data = jwt_decode(req.headers.token)
    const { id, role } = data

    // Check if user is admin
    if (!id || role !== "Admin") {
      return res.status(401).json({
        status: false,
        message: "Unauthorized - Admin access required",
      })
    }

    const { base_service_id, companies, bikes, dealer_id, description } = req.body

    /* =========================
       1. Validate base_service_id
    ========================== */
    if (!base_service_id || !mongoose.Types.ObjectId.isValid(base_service_id)) {
      return res.status(400).json({
        status: false,
        message: "Valid base_service_id is required",
        field: "base_service_id",
      })
    }

    // Check if BaseService exists
    const baseService = await BaseService.findById(base_service_id)
    if (!baseService) {
      return res.status(404).json({
        status: false,
        message: "Base service not found",
        field: "base_service_id",
      })
    }

    if (!dealer_id || !mongoose.Types.ObjectId.isValid(dealer_id)) {
      return res.status(400).json({
        status: false,
        message: "Valid dealer_id is required",
        field: "dealer_id",
      })
    }

    /* =========================
       2. Validate companies
    ========================== */
    let parsedCompanies = []
    try {
      parsedCompanies = typeof companies === "string" ? JSON.parse(companies) : companies
    } catch {
      return res.status(400).json({
        status: false,
        message: "Invalid companies format",
        field: "companies",
      })
    }

    if (!Array.isArray(parsedCompanies) || parsedCompanies.length === 0) {
      return res.status(400).json({
        status: false,
        message: "At least one company is required",
        field: "companies",
      })
    }

    for (let i = 0; i < parsedCompanies.length; i++) {
      if (!mongoose.Types.ObjectId.isValid(parsedCompanies[i])) {
        return res.status(400).json({
          status: false,
          message: `Invalid companyId at index ${i}`,
          field: `companies[${i}]`,
        })
      }
    }

    /* =========================
       3. Validate CC-wise pricing
    ========================== */
    let parsedBikes = []
    try {
      parsedBikes = typeof bikes === "string" ? JSON.parse(bikes) : bikes
    } catch {
      return res.status(400).json({
        status: false,
        message: "Invalid bikes format",
        field: "bikes",
      })
    }

    if (!Array.isArray(parsedBikes) || parsedBikes.length === 0) {
      return res.status(400).json({
        status: false,
        message: "At least one CC price is required",
        field: "bikes",
      })
    }

    for (let i = 0; i < parsedBikes.length; i++) {
      const { cc, price, model_id, variant_id } = parsedBikes[i]

      if (model_id && !mongoose.Types.ObjectId.isValid(model_id)) {
        return res.status(400).json({
          status: false,
          message: `Invalid modelId at index ${i}`,
          field: `bikes[${i}].model_id`,
        })
      }

      if (variant_id && !mongoose.Types.ObjectId.isValid(variant_id)) {
        return res.status(400).json({
          status: false,
          message: `Invalid variantId at index ${i}`,
          field: `bikes[${i}].variant_id`,
        })
      }

      if (!cc || isNaN(cc) || cc <= 0) {
        return res.status(400).json({
          status: false,
          message: `Invalid CC at index ${i}`,
          field: `bikes[${i}].cc`,
        })
      }

      if (!price || isNaN(price) || price <= 0) {
        return res.status(400).json({
          status: false,
          message: `Invalid price at index ${i}`,
          field: `bikes[${i}].price`,
        })
      }
    }

    /* =========================
       4. Update admin service
    ========================== */
    const updatedService = await adminservices
      .findByIdAndUpdate(
        id,
        {
          base_service_id,
          companies: parsedCompanies,
          dealer_id,
          bikes: parsedBikes,
          description: description || "",
        },
        { new: true },
      )
      .populate("base_service_id", "name image")
      .populate("companies", "name")
      .populate("dealer_id", "shopName id")

    if (!updatedService) {
      return res.status(404).json({
        status: false,
        message: "Admin service not found",
      })
    }

    return res.status(200).json({
      status: true,
      message: "Admin service updated successfully",
      data: updatedService,
    })
  } catch (error) {
    console.error("Error updating admin service:", error)
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    })
  }
}

async function deleteAdminService(req, res) {
  try {
    const { id } = req.params

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Valid service ID is required",
      })
    }

    const deletedService = await adminservices.findByIdAndDelete(id)

    if (!deletedService) {
      return res.status(404).json({
        status: false,
        message: "Admin service not found",
      })
    }

    return res.status(200).json({
      status: true,
      message: "Admin service deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting admin service:", error)
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    })
  }
}

/**
 * NEW: Dealer Services (Read-Only)
 * GET /dealer/services
 */
async function getDealerServices(req, res) {
  try {
    // Extract dealer_id from token
    if (!req.headers.token) {
      return res.status(401).json({
        status: false,
        message: "Token required",
      })
    }

    const data = jwt_decode(req.headers.token)
    const dealer_id = data.user_id || data.dealer_id || data.id
    if (!dealer_id || !mongoose.Types.ObjectId.isValid(dealer_id)) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized",
      })
    }

    // Fetch AdminServices where this dealer is included
    const services = await adminservices
      .find({
        dealers: dealer_id,
      })
      .populate("base_service_id", "name image")
      .populate("companies", "name")
      .select("base_service_id bikes")

    // Format response: return only service info + pricing
    const formattedServices = services.map((service) => ({
      _id: service._id,
      name: service.base_service_id?.name,
      image: service.base_service_id?.image,
      bikes: service.bikes,
      createdAt: service.createdAt,
    }))

    return res.status(200).json({
      status: true,
      message: services.length > 0 ? "Services fetched successfully" : "No services found",
      data: formattedServices,
    })
  } catch (error) {
    console.error("Error fetching dealer services:", error)
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    })
  }
}

/**
 * NEW: Admin can fetch all services for a specific dealer using dealer_id parameter
 * This endpoint is used in the admin panel to view dealer's services
 * GET /admin/services/by-dealer/:dealer_id
 */
async function getAdminServicesByDealer(req, res) {
  try {
    const { dealer_id } = req.params

    if (!dealer_id || !mongoose.Types.ObjectId.isValid(dealer_id)) {
      return res.status(400).json({
        status: false,
        message: "Valid dealer ID is required",
      })
    }

    // Fetch all AdminServices where this dealer is included
    const services = await adminservices
      .find({
        dealers: dealer_id,
      })
      .populate("base_service_id", "name image")
      .populate("companies", "name")
      .populate({
        path: "bikes.model_id",
        select: "model_name",
      })
      .populate({
        path: "bikes.variant_id",
        select: "variant_name",
      })
      .sort({ createdAt: -1 })

    // Format response with service details and pricing
    const formattedServices = services.map((service) => ({
      _id: service._id,
      serviceId: service.serviceId || null,
      name: service.base_service_id?.name,
      image: service.base_service_id?.image,
      companies: service.companies,
      bikes: service.bikes,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    }))

    return res.status(200).json({
      status: true,
      message: formattedServices.length > 0 ? "Services fetched successfully" : "No services found for this dealer",
      data: formattedServices,
    })
  } catch (error) {
    console.error("Error fetching admin services by dealer:", error)
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    })
  }
}

async function additionalservicelist(req, res) {
  try {
    const services = await additionalService.find().populate("dealer_id", "name email").sort({ id: -1 })

    return res.status(200).send({
      status: 200,
      message: services.length > 0 ? "Success" : "No services available",
      data: services,
    })
  } catch (error) {
    console.error("Error fetching services:", error)
    return res.status(200).send({ status: 500, message: "Internal Server Error" })
  }
}

async function addAdditionalService(req, res) {
  try {
    const { name, description, dealer_id, bikes: bikesString } = req.body
    console.log("Raw Request Body:", req.body)

    // Validate: name
    if (!name || name.trim() === "") {
      return res.status(400).json({
        status: 400,
        message: "Additional Service name is required.",
        field: "name",
      })
    }

    // Validate: dealer_id
    if (!dealer_id || !mongoose.Types.ObjectId.isValid(dealer_id)) {
      return res.status(400).json({
        status: 400,
        message: "Valid dealer ID is required.",
        field: "dealer_id",
      })
    }

    // Parse and validate bikes
    let parsedBikes = []
    try {
      // Parse the JSON string to array
      parsedBikes = JSON.parse(bikesString)

      if (!Array.isArray(parsedBikes)) {
        throw new Error("Bikes must be an array")
      }

      // Validate each bike object
      parsedBikes = parsedBikes.map((bike, index) => {
        if (!bike || typeof bike !== "object") {
          throw new Error(`Bike at index ${index} is not a valid object`)
        }

        const cc = Number(bike.cc)
        const price = Number(bike.price)
        const model_id = bike.model_id
        const variant_id = bike.variant_id

        if (model_id && !mongoose.Types.ObjectId.isValid(model_id)) {
          throw new Error(`Invalid modelId at index ${index}`)
        }

        if (variant_id && !mongoose.Types.ObjectId.isValid(variant_id)) {
          throw new Error(`Invalid variantId at index ${index}`)
        }

        if (isNaN(cc)) {
          throw new Error(`Invalid cc value at index ${index}`)
        }
        if (isNaN(price)) {
          throw new Error(`Invalid price value at index ${index}`)
        }

        return {
          cc,
          price,
          model_id,
          variant_id,
        }
      })
    } catch (err) {
      console.error("Bikes parsing error:", err)
      return res.status(400).json({
        status: 400,
        message: "Invalid bikes data: " + err.message,
        field: "bikes",
      })
    }

    if (parsedBikes.length === 0) {
      return res.status(400).json({
        status: 400,
        message: "At least one bike configuration is required",
        field: "bikes",
      })
    }

    // Handle image
    const image = req.file ? `uploads/additional-options/${req.file.filename}` : ""

    // Create service
    const newService = await additionalService.create({
      name: name.trim(),
      description: description?.trim() || "",
      dealer_id,
      bikes: parsedBikes,
      image,
    })

    console.log("New Additional Service with Bikes:", newService)

    return res.status(201).json({
      status: 201,
      message: "Additional Service added successfully",
      data: newService,
    })
  } catch (error) {
    console.error("Error adding service:", error)
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error: " + error.message,
    })
  }
}

async function deleteAdditionaalService(req, res) {
  try {
    const { id } = req.params
    console.log("Delete Service ID:", id)
    if (!id) {
      return res.status(200).send({ status: 400, message: "Service ID is required!" })
    }

    const deletedService = await additionalService.findByIdAndDelete(id)
    return res.status(200).send({
      status: 200,
      message: deletedService ? "Service deleted successfully" : "Service not found!",
    })
  } catch (error) {
    console.error("Error deleting service:", error)
    return res.status(200).send({ status: 500, message: "Internal Server Error" })
  }
}

async function getAdditionalServiceById(req, res) {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(200).send({
        status: 400,
        message: "Service ID is required!",
      })
    }

    const serviceData = await additionalService.findById(id).populate("dealer_id", "shopName email phone").lean()

    if (!serviceData) {
      return res.status(200).send({
        status: 404,
        message: "Service not found!",
      })
    }

    // Format the response data
    const responseData = {
      _id: serviceData._id,
      name: serviceData.name,
      image: serviceData.image,
      description: serviceData.description,
      dealer_id: {
        _id: serviceData.dealer_id?._id,
        shopName: serviceData.dealer_id?.shopName,
        email: serviceData.dealer_id?.email,
        phone: serviceData.dealer_id?.phone,
      },
      bikes: serviceData.bikes || [],
      createdAt: serviceData.createdAt,
      updatedAt: serviceData.updatedAt,
    }

    return res.status(200).send({
      status: 200,
      message: "Service retrieved successfully",
      data: responseData,
    })
  } catch (error) {
    console.error("Error fetching service by ID:", error)

    if (error instanceof mongoose.Error.CastError) {
      return res.status(200).send({
        status: 400,
        message: "Invalid service ID format",
      })
    }

    return res.status(200).send({
      status: 500,
      message: "Internal Server Error",
    })
  }
}

async function updateAdditionalServiceById(req, res) {
  try {
    const { id } = req.params
    console.log("Id:", id)
    const { name, description, dealer_id, bikes } = req.body

    console.log("Request Body for Update:", req.body)

    // Validate required fields
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        message: "Valid service ID is required",
      })
    }

    if (!name || name.trim() === "") {
      return res.status(400).json({
        status: 400,
        message: "Service name is required",
        field: "name",
      })
    }

    if (!dealer_id || !mongoose.Types.ObjectId.isValid(dealer_id)) {
      return res.status(400).json({
        status: 400,
        message: "Valid dealer ID is required",
        field: "dealer_id",
      })
    }

    // Parse bikes data
    let parsedBikes = []
    try {
      parsedBikes = bikes ? JSON.parse(bikes) : []
    } catch (error) {
      return res.status(400).json({
        status: 400,
        message: "Invalid bikes data format",
        field: "bikes",
      })
    }

    // Validate bikes array
    if (!Array.isArray(parsedBikes) || parsedBikes.length === 0) {
      return res.status(400).json({
        status: 400,
        message: "At least one bike configuration is required",
        field: "bikes",
      })
    }

    // Validate each bike object
    for (let i = 0; i < parsedBikes.length; i++) {
      const bike = parsedBikes[i]
      const model_id = bike.model_id
      const variant_id = bike.variant_id

      if (model_id && !mongoose.Types.ObjectId.isValid(model_id)) {
        return res.status(400).json({
          status: 400,
          message: `Invalid modelId at index ${i}`,
          field: `bikes[${i}].model_id`,
        })
      }

      if (variant_id && !mongoose.Types.ObjectId.isValid(variant_id)) {
        return res.status(400).json({
          status: 400,
          message: `Invalid variantId at index ${i}`,
          field: `bikes[${i}].variant_id`,
        })
      }

      if (!bike.cc || isNaN(bike.cc) || bike.cc <= 0) {
        return res.status(400).json({
          status: 400,
          message: `Bike at index ${i} must have valid CC > 0`,
          field: `bikes[${i}].cc`,
        })
      }
      if (!bike.price || isNaN(bike.price) || bike.price <= 0) {
        return res.status(400).json({
          status: 400,
          message: `Bike at index ${i} must have valid price > 0`,
          field: `bikes[${i}].price`,
        })
      }
    }

    // Prepare update data
    const updateData = {
      name: name.trim(),
      description: description?.trim() || "",
      dealer_id,
      bikes: parsedBikes,
    }

    // Handle image upload if exists
    if (req.file) {
      updateData.image = `uploads/additional-options/${req.file.filename}`
    }

    // Update the service
    const updatedService = await additionalService
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate("dealer_id", "shopName email phone")

    if (!updatedService) {
      return res.status(404).json({
        status: 404,
        message: "Service not found",
      })
    }

    // Format the response
    const responseData = {
      _id: updatedService._id,
      name: updatedService.name,
      image: updatedService.image,
      description: updatedService.description,
      dealer_id: {
        _id: updatedService.dealer_id?._id,
        shopName: updatedService.dealer_id?.shopName,
        email: updatedService.dealer_id?.email,
        phone: updatedService.dealer_id?.phone,
      },
      bikes: updatedService.bikes || [],
      createdAt: updatedService.createdAt,
      updatedAt: updatedService.updatedAt,
    }

    return res.status(200).json({
      status: 200,
      message: "Service updated successfully",
      data: responseData,
    })
  } catch (error) {
    console.error("Error updating service:", error)
    return res.status(500).json({
      status: 500,
      message: "Internal server error",
    })
  }
}

async function getServiceById(req, res) {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(200).send({
        status: 400,
        message: "Service ID is required!",
      })
    }

    const serviceData = await service.findById(id).populate("dealer_id", "shopName email phone").lean()

    if (!serviceData) {
      return res.status(200).send({
        status: 404,
        message: "Service not found!",
      })
    }

    // Format the response data
    const responseData = {
      _id: serviceData._id,
      name: serviceData.name,
      image: serviceData.image,
      description: serviceData.description,
      dealer_id: {
        _id: serviceData.dealer_id?._id,
        shopName: serviceData.dealer_id?.shopName,
        email: serviceData.dealer_id?.email,
        phone: serviceData.dealer_id?.phone,
      },
      bikes: serviceData.bikes || [],
      createdAt: serviceData.createdAt,
      updatedAt: serviceData.updatedAt,
    }

    return res.status(200).send({
      status: 200,
      message: "Service retrieved successfully",
      data: responseData,
    })
  } catch (error) {
    console.error("Error fetching service by ID:", error)

    if (error instanceof mongoose.Error.CastError) {
      return res.status(200).send({
        status: 400,
        message: "Invalid service ID format",
      })
    }

    return res.status(200).send({
      status: 500,
      message: "Internal Server Error",
    })
  }
}

async function updateServiceById(req, res) {
  try {
    const { id } = req.params
    const { name, description, dealer_id, bikes } = req.body

    // Validate: name
    if (!name || name.trim() === "") {
      return res.status(200).send({
        status: 400,
        message: "Service name is required.",
        field: "name",
      })
    }

    // Validate: dealer_id
    if (!dealer_id || !mongoose.Types.ObjectId.isValid(dealer_id)) {
      return res.status(200).send({
        status: 400,
        message: "Valid dealer ID is required.",
        field: "dealer_id",
      })
    }

    // Validate and parse bikes
    let parsedBikes = []

    if (!bikes) {
      return res.status(200).send({
        status: 400,
        message: "Bikes field is required.",
        field: "bikes",
      })
    }

    try {
      if (typeof bikes === "string") {
        if (bikes.trim() === "") {
          return res.status(200).send({
            status: 400,
            message: "Bikes field is required.",
            field: "bikes",
          })
        }
        parsedBikes = JSON.parse(bikes)
      } else {
        parsedBikes = bikes
      }

      if (!Array.isArray(parsedBikes) || parsedBikes.length === 0) {
        return res.status(200).send({
          status: 400,
          message: "Bikes must be a non-empty array.",
          field: "bikes",
        })
      }

      for (let i = 0; i < parsedBikes.length; i++) {
        const bike = parsedBikes[i]

        // Convert to numbers
        bike.cc = Number(bike.cc)
        bike.price = Number(bike.price)

        if (isNaN(bike.cc) || isNaN(bike.price)) {
          return res.status(200).send({
            status: 400,
            message: `Bike at index ${i} must have numeric 'cc' and 'price' values.`,
            field: "bikes",
          })
        }
      }
    } catch (err) {
      return res.status(200).send({
        status: 400,
        message: "Invalid bikes format. Must be JSON array.",
        field: "bikes",
      })
    }

    // Handle image
    const image = req.file ? `uploads/services/${req.file.filename}` : ""

    // multer will save image file

    // Create service
    const newService = await service.create({
      name: name.trim(),
      description: description?.trim() || "",
      image,
      dealer_id,
      bikes: parsedBikes,
    })

    return res.status(200).send({
      status: 200,
      message: "Service added successfully",
      data: newService,
    })
  } catch (error) {
    console.error("Error adding service:", error)
    return res.status(200).send({
      status: 500,
      message: "Internal Server Error",
    })
  }
}

module.exports = {
  servicelist,
  singleService,
  updateService,
  deleteService,
  getServicesByDealer,
  addAdminService,
  listAdminServices,
  getServiceById,
  updateServiceById,
  addAdditionalService,
  additionalservicelist,
  deleteAdditionaalService,
  getAdditionalServiceById,
  updateAdditionalServiceById,
  getAdminServiceById,
  updateAdminService,
  deleteAdminService,
  getDealerServices,
  getAdminServicesByDealer,
}
