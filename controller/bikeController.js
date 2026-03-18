const mongoose = require("mongoose")
require("dotenv").config()
const bikeModel = require("../models/bikeModel")
const jwt_decode = require("jwt-decode")
const Role = require("../models/Roles_modal")
const Admin = require("../models/admin_model")
const BikeVariant = require("../models/bikeVariantModel")
const BikeModel = require("../models/bikeModel")
const BikeCompany = require("../models/bikeCompanyModel")
const AdminService  = require("../models/adminService")

async function checkPermission(user_id, requiredPermission) {
  try {
    const userRole = await Role.findOne({ subAdmin: user_id })
    console.log(userRole, "1")
    if (!userRole) {
      return false
    }
    const permissions = userRole.permissions
    console.log(permissions, "2")

    const [module, permission] = requiredPermission.split(".")

    // Check if the module and permission exist in permissions object
    if (!permissions || !permissions[module] || !permissions[module][permission]) {
      return false
    }
    return true
  } catch (error) {
    console.error("Error while checking permission:", error)
    return false
  }
}

async function addBike(req, res) {
  // created by  store or vendor
  try {
    if (!req.headers.token) {
      return res.status(401).send({ status: 401, message: "Token not provided" })
    }
    const data = jwt_decode(req.headers.token)
    const user_id = data.user_id
    const user_type = data.user_type
    const type = data.type
    if (user_id == null || (user_type != 3 && user_type != 1)) {
      var response = {
        status: 401,
        message: "admin is un-authorised !",
      }
      return res.status(401).send(response)
    }

    const { name, model, bike_cc } = req.body

    // var image = req.files.image[0].filename;
    // const userdetail = await admin.findOne({_id:user_id});

    const bikes = await bikeModel.aggregate([
      {
        $match: {
          $and: [
            {
              model: model,
            },
            {
              bike_cc: Number.parseInt(bike_cc),
            },
          ],
        },
      },
    ])

    if (bikes.length > 0) {
      return res.status(201).send({
        status: 201,
        message: "Bike is Already Added",
      })
    }

    const datas = {
      name: name,
      model: model,
      bike_cc: bike_cc,
    }

    const bikeRes = await bikeModel.create(datas)

    if (bikeRes) {
      return res.status(200).send({
        status: 200,
        message: "Vehicle added successfully",
        data: bikeRes,
      })
    } else {
      return res.status(201).send({
        status: 201,
        message: "Unable to add Vehicle",
      })
    }
  } catch (error) {
    console.log("error", error)
    return res.status(201).send({
      status: 201,
      message: "Operation was not successful",
    })
  }
}

async function bikeList(req, res) {
  try {
    if (!req.headers.token) {
      return res.status(401).send({ status: 401, message: "Token not provided" })
    }
    const data = jwt_decode(req.headers.token)
    const user_id = data.user_id
    const user_type = data.user_type
    const type = data.type
    if (user_id == null || (user_type != 1 && user_type != 3 && user_type != 4)) {
      var response = {
        status: 401,
        message: "admin is un-authorised !",
      }
      return res.status(401).send(response)
    }

    var bikeRes = await bikeModel.find({}).sort({ _id: -1 })
    // var bikeRes = await bikeModel.find({}).sort({ model: 1 })

    if (bikeRes.length > 0) {
      return res.status(200).send({
        status: 200,
        message: "success",
        data: bikeRes,
      })
    } else {
      return res.status(201).send({
        status: 201,
        data: [],
        message: "No Vehicle Found",
      })
    }
  } catch (error) {
    console.log("error", error)
    return res.status(201).send({
      status: 201,
      message: "Operation was not successful",
    })
  }
}

async function deleteBike(req, res) {
  try {
    if (!req.headers.token) {
      return res.status(401).send({ status: 401, message: "Token not provided" })
    }
    const data = jwt_decode(req.headers.token)
    const user_id = data.user_id || data.id
    const user_type = data.user_type
    const role = data.role

    if (user_id == null || (user_type != 1 && role !== "Admin")) {
      return res.status(401).send({
        status: 401,
        message: "Only Admin can delete bikes!",
      })
    }

    const bike_id = req.params.id

    const bikeRes = await BikeVariant.findByIdAndDelete(bike_id)

    if (bikeRes) {
      return res.status(200).send({
        status: 200,
        message: "vehicle deleted successfully",
      })
    } else {
      const modelRes = await BikeModel.findByIdAndDelete(bike_id)
      if (modelRes) {
        return res.status(200).send({
          status: 200,
          message: "vehicle model deleted successfully",
        })
      }
      return res.status(404).send({
        status: 404,
        message: "vehicle not found",
      })
    }
  } catch (error) {
    console.log("[v0] error in deleteBike:", error)
    return res.status(500).send({
      status: 500,
      message: "Internal server error during deletion",
    })
  }
}

async function deleteBikeModel(req, res) {
  try {
    if (!req.headers.token) {
      return res.status(401).send({ status: 401, message: "Token not provided" })
    }
    const data = jwt_decode(req.headers.token)
    const user_id = data.user_id || data.id
    const user_type = data.user_type
    const role = data.role

    if (user_id == null || (user_type != 1 && role !== "Admin")) {
      return res.status(401).send({
        status: 401,
        message: "Only Admin can delete bike models!",
      })
    }

    const model_id = req.params.id

    // Delete all variants for this model
    await BikeVariant.deleteMany({ model_id })
    // Delete the model itself
    const modelRes = await BikeModel.findByIdAndDelete(model_id)

    if (modelRes) {
      return res.status(200).send({
        status: 200,
        message: "Bike model and its variants deleted successfully",
      })
    } else {
      return res.status(404).send({
        status: 404,
        message: "Bike model not found",
      })
    }
  } catch (error) {
    console.error("Error in deleteBikeModel:", error)
    return res.status(500).send({
      status: 500,
      message: "Internal server error during bike model deletion",
    })
  }
}

async function deleteBikeCompany(req, res) {
  try {
    if (!req.headers.token) {
      return res.status(401).send({ status: 401, message: "Token not provided" })
    }
    const data = jwt_decode(req.headers.token)
    const user_id = data.user_id || data.id
    const user_type = data.user_type
    const role = data.role

    if (user_id == null || (user_type != 1 && role !== "Admin")) {
      return res.status(401).send({
        status: 401,
        message: "Only Admin can delete bike companies!",
      })
    }

    const company_id = req.params.id

    // Find all models for this company
    const models = await BikeModel.find({ company_id })
    const modelIds = models.map((m) => m._id)

    // Delete all variants for these models
    await BikeVariant.deleteMany({ model_id: { $in: modelIds } })
    // Delete all models for this company
    await BikeModel.deleteMany({ company_id })
    // Delete the company itself
    const companyRes = await BikeCompany.findByIdAndDelete(company_id)

    if (companyRes) {
      return res.status(200).send({
        status: 200,
        message: "Bike company, its models, and variants deleted successfully",
      })
    } else {
      return res.status(404).send({
        status: 404,
        message: "Bike company not found",
      })
    }
  } catch (error) {
    console.error("Error in deleteBikeCompany:", error)
    return res.status(500).send({
      status: 500,
      message: "Internal server error during bike company deletion",
    })
  }
}

async function editBike(req, res) {
  try {
    if (!req.headers.token) {
      return res.status(401).send({ status: 401, message: "Token not provided" })
    }
    const data = jwt_decode(req.headers.token)
    const user_id = data.user_id || data.id
    const user_type = data.user_type
    const role = data.role

    if (user_id == null || (user_type != 1 && role !== "Admin")) {
      return res.status(401).send({
        status: 401,
        message: "Only Admin can edit bikes!",
      })
    }
    const { name, model_name, engine_cc, extra_charges, variant_name } = req.body
    const bike_id = req.params.id

    const updateData = { variant_name: name || variant_name, engine_cc: engine_cc, extra_charges }
    const bikeResult = await BikeVariant.findByIdAndUpdate(bike_id, { $set: updateData }, { new: true })

    if (bikeResult) {
      return res.status(200).send({
        status: 200,
        message: "Vehicle updated successfully",
        data: bikeResult,
      })
    } else {
      const modelUpdate = { model_name: model_name || name }
      const modelResult = await BikeModel.findByIdAndUpdate(bike_id, { $set: modelUpdate }, { new: true })
      if (modelResult) {
        return res.status(200).send({
          status: 200,
          message: "Vehicle model updated successfully",
          data: modelResult,
        })
      }
      return res.status(404).send({
        status: 404,
        message: "Vehicle not found",
      })
    }
  } catch (error) {
    console.log("[v0] error in editBike:", error)
    return res.status(500).send({
      status: 500,
      message: "Operation was not successful",
    })
  }
}

async function getBike(req, res) {
  try {
    if (!req.headers.token) {
      return res.status(401).send({ status: 401, message: "Token not provided" })
    }
    const data = jwt_decode(req.headers.token)
    const user_id = data.user_id
    const user_type = data.user_type
    const type = data.type
    if (user_id == null || (user_type != 4 && user_type != 1 && user_type != 3 && user_type != 2)) {
      var response = {
        status: 401,
        message: "admin is un-authorised !",
      }
      return res.status(401).send(response)
    }

    var bikeRes = await bikeModel.findById(req.params.id)
    if (!bikeRes) {
      return res.status(404).send({
        status: 404,
        message: "No Bike Found",
      })
    }
    return res.status(200).send({
      status: 200,
      message: "success",
      data: bikeRes,
    })
  } catch (error) {
    console.log("error", error)
    return res.status(500).send({
      status: 500,
      message: "Operation was not successful",
    })
  }
}

const addBikeCompany = async (req, res) => {
  try {
    let { name } = req.body

    if (!name) {
      return res.status(200).json({
        status: 200,
        message: "Bike company name is required!",
        data: [],
      })
    }

    name = name.trim().toUpperCase() // Normalize to uppercase

    const existingCompany = await BikeCompany.findOne({ name })

    if (existingCompany) {
      return res.status(200).json({
        status: 200,
        message: "Bike company already exists!",
        data: [],
      })
    }

    const newCompany = new BikeCompany({ name })
    await newCompany.save()

    res.status(200).json({
      status: 200,
      message: "Bike company added successfully",
      data: newCompany,
    })
  } catch (error) {
    console.error("Error adding bike company:", error)
    res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      data: [],
    })
  }
}

const addBikeModel = async (req, res) => {
  try {
    const { company_id, model_name } = req.body

    if (!company_id || !model_name) {
      return res.status(200).json({
        status: 200,
        message: "company_id and model_name are required!",
        data: [],
      })
    }

    const normalizedModelName = model_name.trim().toUpperCase()

    // Check if model already exists for the same company (case-insensitive)
    const existingModel = await BikeModel.findOne({
      company_id,
      model_name: normalizedModelName,
    })

    if (existingModel) {
      return res.status(200).json({
        status: 200,
        message: "Bike model already exists for this company!",
        data: [],
      })
    }

    const newModel = new BikeModel({
      company_id,
      model_name: normalizedModelName,
    })

    await newModel.save()

    res.status(200).json({
      status: 200,
      message: "Bike model added successfully",
      data: newModel,
    })
  } catch (error) {
    console.error("Error adding bike model:", error)
    res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      data: [],
    })
  }
}

const addBikeVariant = async (req, res) => {
  try {
    const { model_id, variant_name, engine_cc } = req.body

    if (!model_id || !variant_name || !engine_cc) {
      return res
        .status(200)
        .json({ status: 200, message: "model_id, variant_name, and engine_cc are required!", data: [] })
    }

    const newVariant = new BikeVariant({ model_id, variant_name, engine_cc })
    await newVariant.save()

    res.status(200).json({ status: 200, message: "Bike variant added successfully", data: newVariant })
  } catch (error) {
    console.error("Error adding bike variant:", error)
    res.status(500).json({ status: 500, message: "Internal Server Error", data: [] })
  }
}

const getBikeCompanies = async (req, res) => {
  try {
    const companies = await BikeCompany.find().sort({ name: 1 })

    if (!companies.length) {
      return res.status(200).json({ status: 200, message: "No bike companies found!", data: [] })
    }

    res.status(200).json({ status: 200, message: "Bike companies retrieved successfully!", data: companies })
  } catch (error) {
    console.error("Error fetching bike companies:", error)
    res.status(500).json({ status: 500, message: "Internal Server Error", data: [] })
  }
}

const getBikeModels = async (req, res) => {
  try {
    const { company_id } = req.params

    if (!company_id) {
      return res.status(200).json({ status: 200, message: "company_id is required!", data: [] })
    }

    const models = await BikeModel.find({ company_id }).sort({ model_name: 1 })

    if (!models.length) {
      return res.status(200).json({ status: 200, message: "No models found for this company!", data: [] })
    }

    res.status(200).json({ status: 200, message: "Bike models retrieved successfully!", data: models })
  } catch (error) {
    console.error("Error fetching bike models:", error)
    res.status(500).json({ status: 500, message: "Internal Server Error", data: [] })
  }
}

const getBikeVariants = async (req, res) => {
  try {
    const { model_id } = req.params

    if (!model_id) {
      return res.status(200).json({ status: 200, message: "model_id is required!", data: [] })
    }

    const variants = await BikeVariant.find({ model_id }).sort({ engine_cc: 1 })

    if (!variants.length) {
      return res.status(200).json({ status: 200, message: "No variants found for this model!", data: [] })
    }

    res.status(200).json({ status: 200, message: "Bike variants retrieved successfully!", data: variants })
  } catch (error) {
    console.error("Error fetching bike variants:", error)
    res.status(500).json({ status: 500, message: "Internal Server Error", data: [] })
  }
}

const getAllBikes = async (req, res) => {
  try {
    const companies = await BikeCompany.find()
      .populate({
        path: "models",
        select: "model_name",
        populate: {
          path: "variants",
          select: "variant_name engine_cc",
        },
      })
      .lean()

    res.status(200).json({
      status: 200,
      message: "All bikes retrieved successfully",
      data: companies,
    })
  } catch (error) {
    console.error("Error fetching bikes:", error)
    res.status(500).json({ status: 500, message: "Internal Server Error", data: [] })
  }
}

async function getCcByCompany(req, res) {
  try {
    const { companyIds } = req.params

    if (!companyIds) {
      return res.status(400).json({
        status: false,
        message: "companyIds are required",
      })
    }

    const idArray = companyIds
      .split(",")
      .map((id) => id.trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id))

    console.log("[v0] Processing company IDs:", idArray)

    if (!idArray.length) {
      return res.status(400).json({
        status: false,
        message: "No valid company IDs provided",
      })
    }

    const models = await BikeModel.find({ company_id: { $in: idArray } })
      .select("_id model_name company_id")
      .lean()

    console.log("[v0] Models found for company IDs:", models.length)

    if (!models.length) {
      const companies = await BikeCompany.find({ _id: { $in: idArray } })
        .populate("models")
        .lean()
      const foundModels = companies.flatMap((c) => c.models || [])

      if (foundModels.length > 0) {
        models.push(...foundModels)
      } else {
        return res.status(200).json({
          status: true,
          message: "No models found for the provided company IDs",
          data: [],
        })
      }
    }

    const modelIds = models.map((m) => m._id)

    const variants = await BikeVariant.find({
      model_id: { $in: modelIds },
    })
      .populate({
        path: "model_id",
        select: "model_name company_id",
      })
      .lean()

    console.log("[v0] Variants found for model IDs:", variants.length)

    const data = variants
      .map((v) => ({
        engine_cc: v.engine_cc,
        company_id: v.model_id?.company_id,
        model_id: v.model_id?._id,
        model_name: v.model_id?.model_name,
        variant_id: v._id,
        variant_name: v.variant_name,
      }))
      .sort((a, b) => a.engine_cc - b.engine_cc)

    return res.status(200).json({
      status: true,
      message: "Bike details fetched successfully",
      data: data,
    })
  } catch (error) {
    console.error("[v0] Error fetching CC by company:", error)
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
    })
  }
}

async function getBikeDetailsByCompany(req, res) {
  try {
    const { companyIds } = req.query

    /* =========================
       1. Validate companyIds
    ========================== */
    if (!companyIds) {
      return res.status(400).json({
        status: 400,
        message: "companyIds (comma-separated) are required",
        data: [],
      })
    }

    const idArray = companyIds
      .split(",")
      .map(id => id.trim())
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id))

    if (!idArray.length) {
      return res.status(400).json({
        status: 400,
        message: "No valid company IDs provided",
        data: [],
      })
    }

    /* =========================
       2. Fetch already-added service bikes
    ========================== */
    const existingServices = await AdminService.find(
      {},
      { bikes: 1 }
    ).lean()

    const usedVariantKeys = new Set() // modelId_variantId
    const usedCcOnly = new Set()      // cc fallback

    existingServices.forEach(service => {
      service.bikes.forEach(bike => {
        if (bike.model_id && bike.variant_id) {
          usedVariantKeys.add(
            `${bike.model_id.toString()}_${bike.variant_id.toString()}`
          )
        } else if (bike.cc) {
          usedCcOnly.add(Number(bike.cc))
        }
      })
    })

    /* =========================
       3. Fetch bike details (Company → Model → Variant)
    ========================== */
    const bikeDetails = await BikeCompany.aggregate([
      { $match: { _id: { $in: idArray } } },

      {
        $lookup: {
          from: "bikemodels",
          localField: "_id",
          foreignField: "company_id",
          as: "models",
        },
      },
      { $unwind: { path: "$models", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "bikevariants",
          localField: "models._id",
          foreignField: "model_id",
          as: "variants",
        },
      },
      { $unwind: { path: "$variants", preserveNullAndEmptyArrays: true } },

      {
        $project: {
          company_id: "$_id",
          company_name: "$name",
          model_id: "$models._id",
          model_name: "$models.model_name",
          variant_id: "$variants._id",
          variant_name: "$variants.variant_name",
          engine_cc: "$variants.engine_cc",
        },
      },
    ])

    /* =========================
       4. FILTER already-priced bikes
    ========================== */
    const filteredData = bikeDetails
      .map(item => {
        if (!item.model_id || !item.variant_id || !item.engine_cc) {
          return null
        }

        const modelId = item.model_id.toString()
        const variantId = item.variant_id.toString()
        const cc = Number(item.engine_cc)

        const variantKey = `${modelId}_${variantId}`

        // ❌ Exclude if already priced
        if (
          usedVariantKeys.has(variantKey) ||
          usedCcOnly.has(cc)
        ) {
          return null
        }

        return {
          company_id: item.company_id,
          company_name: item.company_name,
          model_id: item.model_id,
          model_name: item.model_name,
          variant_id: item.variant_id,
          variant_name: item.variant_name,
          engine_cc: cc,
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.engine_cc - b.engine_cc)

    /* =========================
       5. Response
    ========================== */
    return res.status(200).json({
      status: 200,
      message: "Bike details fetched successfully",
      data: filteredData,
    })
  } catch (error) {
    console.error("[getBikeDetailsByCompany] Error:", error)
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      data: [],
    })
  }
}

module.exports = {
  addBike,
  bikeList,
  deleteBike,
  deleteBikeModel,
  deleteBikeCompany,
  editBike,
  getBike,
  addBikeCompany,
  addBikeModel,
  addBikeVariant,
  getBikeVariants,
  getBikeModels,
  getBikeCompanies,
  getAllBikes,
  getCcByCompany,
  getBikeDetailsByCompany,
}
