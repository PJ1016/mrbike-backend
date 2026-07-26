const mongoose = require("mongoose")
const BaseService = require("../../models/baseService")
const AdminService = require("../../models/adminService")
const {
  findNearbyDealers,
  getRatingsMap,
  computeServicePopularity,
  resolveBikeContext,
  getCompatibleServiceIds,
  DEFAULT_RADIUS_KM,
} = require("../helpers/geoAndRatings")

function formatImage(url, req) {
  if (url && !url.startsWith("http")) {
    return `${req.protocol}://${req.get("host")}/${url}`
  }
  return url
}

function serializeService(service, req) {
  return {
    serviceId: service._id,
    name: service.name,
    image: formatImage(service.image, req),
    description: service.description,
    categoryId: service.categoryId || null,
    basePrice: service.basePrice,
    duration: service.duration,
    pickupAvailable: service.pickupAvailable,
    warranty: service.warranty,
  }
}

async function resolveDealerScope(req, res) {
  const { lat, lng, city } = req.query
  if (!lat && !lng && !city) {
    return { nearbyDealerIds: null, distanceByDealerId: new Map() }
  }
  try {
    const nearby = await findNearbyDealers({ lat, lng, city })
    const distanceByDealerId = new Map()
    nearby.forEach(({ dealer, distanceKm }) => distanceByDealerId.set(String(dealer._id), distanceKm))
    return { nearbyDealerIds: nearby.map(n => n.dealer._id), distanceByDealerId }
  } catch (err) {
    res.status(400).json({ status: false, message: "Invalid lat/lng" })
    return null
  }
}

// GET /api/v1/home/quick-services?bikeId=&lat=&lng=
//
// Sourced from nearby dealers' own Base Services (AdminService docs), not a
// standalone catalog: we collect what nearby dealers actually offer, filter
// to the bike's brand/model when one is given, then de-dupe by
// base_service_id (one card per service name/type) picking the closest (or,
// with no live location, best-rated) dealer's price for the card.
async function quickServices(req, res) {
  try {
    const { bikeId } = req.query

    const scope = await resolveDealerScope(req, res)
    if (scope === null) return
    const { nearbyDealerIds, distanceByDealerId } = scope

    let bikeContext = null
    if (bikeId) {
      if (!mongoose.Types.ObjectId.isValid(bikeId)) {
        return res.status(400).json({ status: false, message: "Invalid bikeId" })
      }
      bikeContext = await resolveBikeContext(bikeId)
    }

    const dealerServiceFilter = { isActive: true }
    if (nearbyDealerIds) dealerServiceFilter.dealer_id = { $in: nearbyDealerIds }
    if (bikeContext) dealerServiceFilter.companies = bikeContext.companyId

    const dealerServices = await AdminService.find(dealerServiceFilter).select("base_service_id dealer_id bikes")

    // Brand match is enforced by the query above; model match (when a model
    // is pinned on the dealer's mapping) is narrowed here.
    const matchedDealerServices = bikeContext
      ? dealerServices.filter(ds =>
          (ds.bikes || []).some(b => !b.model_id || String(b.model_id) === String(bikeContext.modelId)),
        )
      : dealerServices

    if (!matchedDealerServices.length) {
      return res.status(200).json({
        status: true,
        message: "No quick services found",
        data: [],
        meta: { bikeMatched: !!bikeContext, scope: nearbyDealerIds ? "area" : "network" },
      })
    }

    const ratingsMap = await getRatingsMap(Array.from(new Set(matchedDealerServices.map(ds => String(ds.dealer_id)))))

    const bestByBaseServiceId = new Map()
    matchedDealerServices.forEach(ds => {
      const key = String(ds.base_service_id)
      const distanceKm = distanceByDealerId.get(String(ds.dealer_id))
      const rating = ratingsMap.get(String(ds.dealer_id))?.averageRating || 0
      const candidate = { adminService: ds, distanceKm, rating }
      const current = bestByBaseServiceId.get(key)
      if (!current) {
        bestByBaseServiceId.set(key, candidate)
        return
      }

      const currentHasDistance = current.distanceKm != null
      const candidateHasDistance = candidate.distanceKm != null
      let candidateIsBetter = false
      if (candidateHasDistance && currentHasDistance) candidateIsBetter = candidate.distanceKm < current.distanceKm
      else if (candidateHasDistance && !currentHasDistance) candidateIsBetter = true
      else if (!candidateHasDistance && !currentHasDistance) candidateIsBetter = candidate.rating > current.rating

      if (candidateIsBetter) bestByBaseServiceId.set(key, candidate)
    })

    const popularity = await computeServicePopularity(nearbyDealerIds)

    const baseServiceIds = Array.from(bestByBaseServiceId.keys())
    const baseServices = await BaseService.find({ _id: { $in: baseServiceIds }, isActive: true })
    const baseServiceById = new Map(baseServices.map(s => [String(s._id), s]))

    const ranked = baseServiceIds
      .filter(id => baseServiceById.has(id))
      .map(id => {
        const best = bestByBaseServiceId.get(id)
        const bikes = best.adminService.bikes || []
        const priceMatch = bikeContext
          ? bikes.find(
              b =>
                (!b.variant_id || String(b.variant_id) === String(bikeContext.variantId)) &&
                (bikeContext.cc == null || b.cc === bikeContext.cc),
            ) || bikes.find(b => !b.model_id || String(b.model_id) === String(bikeContext.modelId))
          : null
        const price = priceMatch ? priceMatch.price : bikes.length ? Math.min(...bikes.map(b => b.price)) : null

        return {
          service: baseServiceById.get(id),
          popularity: popularity.get(id) || { count: 0, source: "dealerCount" },
          price,
          dealerId: best.adminService.dealer_id,
          distanceKm: best.distanceKm,
        }
      })
      .sort((a, b) => b.popularity.count - a.popularity.count)
      .slice(0, 8)
      .map(({ service, popularity: p, price, dealerId, distanceKm }) => ({
        ...serializeService(service, req),
        basePrice: price != null ? price : service.basePrice,
        dealerId,
        distanceKm: distanceKm != null ? Number(distanceKm.toFixed(2)) : null,
        popularityCount: p.count,
        popularitySource: p.source,
      }))

    return res.status(200).json({
      status: true,
      message: ranked.length ? "Quick services fetched" : "No quick services found",
      data: ranked,
      meta: { bikeMatched: !!bikeContext, scope: nearbyDealerIds ? "area" : "network" },
    })
  } catch (error) {
    console.error("Error fetching quick services:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

// GET /api/v1/home/recommended?bikeId=&lat=&lng=
async function recommended(req, res) {
  try {
    const { bikeId } = req.query

    const scope = await resolveDealerScope(req, res)
    if (scope === null) return
    const { nearbyDealerIds, distanceByDealerId } = scope

    let allowedServiceIds = null
    let bikeMatched = false
    if (bikeId) {
      if (!mongoose.Types.ObjectId.isValid(bikeId)) {
        return res.status(400).json({ status: false, message: "Invalid bikeId" })
      }
      const bikeContext = await resolveBikeContext(bikeId)
      if (bikeContext) {
        allowedServiceIds = await getCompatibleServiceIds(bikeContext.companyId)
        bikeMatched = true
      }
    }

    const filter = { isActive: true }
    if (allowedServiceIds) filter._id = { $in: allowedServiceIds }
    const services = await BaseService.find(filter)

    const popularity = await computeServicePopularity(nearbyDealerIds)
    const maxCount = Math.max(1, ...Array.from(popularity.values()).map(p => p.count))

    // Nearest dealer distance per base_service_id, within scope.
    let minDistanceByService = new Map()
    if (nearbyDealerIds) {
      const adminServices = await AdminService.find({ dealer_id: { $in: nearbyDealerIds }, isActive: true }).select("base_service_id dealer_id")
      adminServices.forEach(as => {
        const d = distanceByDealerId.get(String(as.dealer_id))
        if (d == null) return
        const key = String(as.base_service_id)
        if (!minDistanceByService.has(key) || d < minDistanceByService.get(key)) {
          minDistanceByService.set(key, d)
        }
      })
    }

    const ranked = services
      .map(s => {
        const key = String(s._id)
        const pop = popularity.get(key) || { count: 0, source: "dealerCount" }
        const minDistance = minDistanceByService.get(key)
        const popularityScore = pop.count / maxCount
        const proximityScore = minDistance != null ? Math.max(0, 1 - minDistance / DEFAULT_RADIUS_KM) : 0
        const score = bikeMatched
          ? 0.5 * popularityScore + 0.3 * proximityScore + 0.2
          : 0.6 * popularityScore + 0.4 * proximityScore

        let reasonCode = "popular"
        let reasonLabel = "Popular near you"
        if (bikeMatched && popularityScore < 0.5 && proximityScore < 0.5) {
          reasonCode = "compatible_with_bike"
          reasonLabel = "Great match for your bike"
        } else if (proximityScore > popularityScore) {
          reasonCode = "nearby"
          reasonLabel = "Available nearby"
        }

        return {
          ...serializeService(s, req),
          score: Number(score.toFixed(3)),
          reasonCode,
          reasonLabel,
          popularityCount: pop.count,
          popularitySource: pop.source,
          nearestDealerDistanceKm: minDistance != null ? Number(minDistance.toFixed(2)) : null,
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    return res.status(200).json({
      status: true,
      message: ranked.length ? "Recommended services fetched" : "No recommendations available",
      data: ranked,
      meta: { bikeMatched, scope: nearbyDealerIds ? "area" : "network" },
    })
  } catch (error) {
    console.error("Error fetching recommended services:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

// GET /api/v1/home/most-booked?lat=&lng=&days=
// `days` windows the booking count (e.g. days=7 for "this week"); omitted = all-time.
async function mostBooked(req, res) {
  try {
    const scope = await resolveDealerScope(req, res)
    if (scope === null) return
    const { nearbyDealerIds } = scope

    const { days } = req.query
    let sinceDate = null
    if (days !== undefined) {
      const numDays = Number.parseInt(days, 10)
      if (Number.isNaN(numDays) || numDays <= 0) {
        return res.status(400).json({ status: false, message: "days must be a positive integer" })
      }
      sinceDate = new Date(Date.now() - numDays * 24 * 60 * 60 * 1000)
    }

    const popularity = await computeServicePopularity(nearbyDealerIds, sinceDate)
    const topIds = Array.from(popularity.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
      .map(([id]) => id)

    const services = await BaseService.find({ _id: { $in: topIds }, isActive: true })
    const byId = new Map(services.map(s => [String(s._id), s]))

    const ranked = topIds
      .filter(id => byId.has(id))
      .map(id => {
        const p = popularity.get(id)
        return {
          ...serializeService(byId.get(id), req),
          bookingCount: p.source === "bookings" ? p.count : null,
          dealerCount: p.source === "dealerCount" ? p.count : null,
          isFallback: p.source === "dealerCount",
        }
      })

    return res.status(200).json({
      status: true,
      message: ranked.length ? "Most booked services fetched" : "No booking data available yet for this area",
      data: ranked,
      meta: { scope: nearbyDealerIds ? "area" : "network", windowDays: sinceDate ? Number.parseInt(days, 10) : null },
    })
  } catch (error) {
    console.error("Error fetching most-booked services:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

// GET /api/v1/home/top-garages?lat=&lng=&serviceId=
async function topGarages(req, res) {
  try {
    const { lat, lng, city, serviceId } = req.query
    if (!lat && !lng && !city) {
      return res.status(400).json({ status: false, message: "lat/lng (or city) is required" })
    }
    if (serviceId && !mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ status: false, message: "Invalid serviceId" })
    }

    let nearby
    try {
      nearby = await findNearbyDealers({ lat, lng, city })
    } catch (err) {
      return res.status(400).json({ status: false, message: "Invalid lat/lng" })
    }

    let eligibleDealerIds = new Set(nearby.map(n => String(n.dealer._id)))

    if (serviceId) {
      const dealerIds = nearby.map(n => n.dealer._id)
      const matching = await AdminService.find({
        dealer_id: { $in: dealerIds },
        base_service_id: serviceId,
        isActive: true,
      }).select("dealer_id bikes")

      const ids = new Set()
      matching.forEach(svc => {
        const hasPricedBike = (svc.bikes || []).some(b => b.price != null && b.price > 0)
        if (hasPricedBike) ids.add(String(svc.dealer_id))
      })
      eligibleDealerIds = ids
    }

    const filtered = nearby.filter(n => eligibleDealerIds.has(String(n.dealer._id)))
    const ratingsMap = await getRatingsMap(filtered.map(n => n.dealer._id))

    const ranked = filtered
      .map(({ dealer, distanceKm }) => {
        const rating = ratingsMap.get(String(dealer._id)) || { averageRating: 0, ratingCount: 0 }
        return {
          dealerId: dealer._id,
          shopName: dealer.shopName,
          city: dealer.city,
          locality: dealer.locality,
          latitude: dealer.latitude,
          longitude: dealer.longitude,
          distanceKm: distanceKm != null ? Number(distanceKm.toFixed(2)) : null,
          averageRating: rating.averageRating,
          ratingCount: rating.ratingCount,
          shopImages: (dealer.shopImages || []).map(url => formatImage(url, req)),
        }
      })
      .sort((a, b) => {
        if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating
        if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm
        return 0
      })
      .slice(0, 5)

    return res.status(200).json({
      status: true,
      message: ranked.length ? "Top garages fetched" : "No garages found nearby",
      data: ranked,
    })
  } catch (error) {
    console.error("Error fetching top garages:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

module.exports = { quickServices, recommended, mostBooked, topGarages }
