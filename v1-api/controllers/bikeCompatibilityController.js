const mongoose = require("mongoose")
const AdminService = require("../../models/adminService")
const BaseService = require("../../models/baseService")
const BikeCompany = require("../../models/bikeCompanyModel")

// GET /api/v1/admin/bike-compatibility/by-service/:serviceId
// Which bike brands does this service actually get configured for, network-wide,
// derived from every dealer's own AdminService.companies[] — not a separate,
// editable master mapping (that field is owned per-dealer in the service wizard).
async function byService(req, res) {
  try {
    const { serviceId } = req.params
    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ status: false, message: "Invalid serviceId" })
    }

    const service = await BaseService.findById(serviceId)
    if (!service) {
      return res.status(404).json({ status: false, message: "Service not found" })
    }

    const rows = await AdminService.aggregate([
      { $match: { base_service_id: new mongoose.Types.ObjectId(serviceId), isActive: true } },
      { $unwind: "$companies" },
      { $group: { _id: "$companies", dealerCount: { $sum: 1 } } },
    ])

    const companyIds = rows.map(r => r._id)
    const companies = await BikeCompany.find({ _id: { $in: companyIds } })
    const countById = new Map(rows.map(r => [String(r._id), r.dealerCount]))

    const data = companies
      .map(c => ({ companyId: c._id, name: c.name, dealerCount: countById.get(String(c._id)) || 0 }))
      .sort((a, b) => b.dealerCount - a.dealerCount)

    return res.status(200).json({
      status: true,
      message: data.length ? "Compatible brands fetched" : "No dealer has configured a brand for this service yet",
      data,
    })
  } catch (error) {
    console.error("Error fetching bike compatibility by service:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

// GET /api/v1/admin/bike-compatibility/by-brand/:companyId
// The reverse view: which services does at least one dealer offer for this brand.
async function byBrand(req, res) {
  try {
    const { companyId } = req.params
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ status: false, message: "Invalid companyId" })
    }

    const company = await BikeCompany.findById(companyId)
    if (!company) {
      return res.status(404).json({ status: false, message: "Bike brand not found" })
    }

    const rows = await AdminService.aggregate([
      { $match: { companies: new mongoose.Types.ObjectId(companyId), isActive: true } },
      { $group: { _id: "$base_service_id", dealerCount: { $sum: 1 } } },
    ])

    const serviceIds = rows.map(r => r._id)
    const services = await BaseService.find({ _id: { $in: serviceIds } })
    const countById = new Map(rows.map(r => [String(r._id), r.dealerCount]))

    const data = services
      .map(s => ({ serviceId: s._id, name: s.name, isActive: s.isActive, dealerCount: countById.get(String(s._id)) || 0 }))
      .sort((a, b) => b.dealerCount - a.dealerCount)

    return res.status(200).json({
      status: true,
      message: data.length ? "Compatible services fetched" : "No dealer has configured this brand for any service yet",
      data,
    })
  } catch (error) {
    console.error("Error fetching bike compatibility by brand:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

module.exports = { byService, byBrand }
