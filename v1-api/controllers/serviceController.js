const mongoose = require("mongoose")
const BaseService = require("../../models/baseService")
const AdminService = require("../../models/adminService")
const { isDealerBookable } = require("../../helper/dealerStatus")
const { getRatingsMap, calculateDistanceKm } = require("../helpers/geoAndRatings")

function formatImage(url, req) {
  if (url && !url.startsWith("http")) {
    return `${req.protocol}://${req.get("host")}/${url}`
  }
  return url
}

// GET /api/v1/services?categoryId=
async function listByCategory(req, res) {
  try {
    const { categoryId } = req.query
    const filter = { isActive: true }

    if (categoryId) {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        return res.status(400).json({ status: false, message: "Invalid categoryId" })
      }
      filter.categoryId = categoryId
    }

    const services = await BaseService.find(filter).populate("categoryId", "name icon").sort({ name: 1 })

    return res.status(200).json({
      status: true,
      message: services.length ? "Services fetched" : "No services found",
      data: services.map(s => ({
        serviceId: s._id,
        name: s.name,
        image: formatImage(s.image, req),
        description: s.description,
        category: s.categoryId ? { id: s.categoryId._id, name: s.categoryId.name, icon: s.categoryId.icon } : null,
        basePrice: s.basePrice,
        duration: s.duration,
        pickupAvailable: s.pickupAvailable,
        warranty: s.warranty,
      })),
    })
  } catch (error) {
    console.error("Error fetching services:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

// GET /api/v1/services/:id/garages?lat=&lng=&variant_id=&cc=
// Full compare list for the Service Detail screen: every bookable dealer
// offering this service, with server-computed price/rating/distance.
async function garagesForService(req, res) {
  try {
    const { id } = req.params
    const { lat, lng, variant_id, cc } = req.query

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: false, message: "Invalid service id" })
    }

    const baseService = await BaseService.findOne({ _id: id, isActive: true })
    if (!baseService) {
      return res.status(404).json({ status: false, message: "Service not found" })
    }

    const adminServices = await AdminService.find({ base_service_id: id, isActive: true }).populate("dealer_id")

    const ccFilter = cc !== undefined && cc !== "" ? Number.parseInt(cc, 10) : null

    let entries = adminServices
      .filter(svc => svc.dealer_id)
      .map(svc => {
        let price = null
        if (variant_id) {
          const match = (svc.bikes || []).find(b => b.variant_id && String(b.variant_id) === String(variant_id) && (ccFilter === null || b.cc === ccFilter))
          price = match ? match.price : null
        } else {
          const prices = (svc.bikes || []).map(b => b.price).filter(p => typeof p === "number")
          price = prices.length ? Math.min(...prices) : null
        }
        return { dealer: svc.dealer_id, price }
      })

    // Only bookable dealers, and only ones that actually have a price for the
    // requested bike (if a bike was specified).
    entries = entries.filter(e => isDealerBookable(e.dealer) && (!variant_id || e.price != null))

    let distanceById = new Map()
    if (lat && lng) {
      const latitude = Number.parseFloat(lat)
      const longitude = Number.parseFloat(lng)
      if (!Number.isNaN(latitude) && !Number.isNaN(longitude)) {
        entries.forEach(e => {
          distanceById.set(String(e.dealer._id), calculateDistanceKm(latitude, longitude, e.dealer.latitude, e.dealer.longitude))
        })
      }
    }

    const ratingsMap = await getRatingsMap(entries.map(e => e.dealer._id))

    const result = entries
      .map(e => {
        const rating = ratingsMap.get(String(e.dealer._id)) || { averageRating: 0, ratingCount: 0 }
        return {
          dealerId: e.dealer._id,
          shopName: e.dealer.shopName,
          city: e.dealer.city,
          locality: e.dealer.locality,
          latitude: e.dealer.latitude,
          longitude: e.dealer.longitude,
          distanceKm: distanceById.has(String(e.dealer._id)) ? Number(distanceById.get(String(e.dealer._id)).toFixed(2)) : null,
          price: e.price,
          averageRating: rating.averageRating,
          ratingCount: rating.ratingCount,
          providesPickup: !!e.dealer.providesPickup,
          providesDrop: !!e.dealer.providesDrop,
        }
      })
      .sort((a, b) => {
        if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating
        if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm
        return 0
      })

    return res.status(200).json({
      status: true,
      message: result.length ? "Garages fetched" : "No garages found for this service nearby",
      data: result,
    })
  } catch (error) {
    console.error("Error fetching garages for service:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

module.exports = { listByCategory, garagesForService }
