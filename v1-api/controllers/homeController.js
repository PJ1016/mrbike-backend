const mongoose = require("mongoose")
const BaseService = require("../../models/baseService")
const {
  getRatingsMap,
  computeServicePopularity,
  DEFAULT_RADIUS_KM,
} = require("../helpers/geoAndRatings")
const {
  resolveDiscoveryBikeContexts,
  resolveDealerScope,
  resolveEligibleServices,
} = require("../helpers/serviceEligibility")

function formatImage(url, req) {
  if (url && !url.startsWith("http")) {
    return `${req.protocol}://${req.get("host")}/${url}`
  }
  return url
}

// Exactly the fields serializeService() below reads. Home responses are the
// hottest reads in the app, and rich Service Detail content is deliberately
// kept in the separate `servicedetails` collection — this projection is the
// belt to that braces, guaranteeing nothing added to BaseService later can
// silently inflate a home payload.
const SERVICE_CARD_FIELDS = "name image description categoryId basePrice duration pickupAvailable warranty"

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

/**
 * Everything every home feed needs, resolved once per request:
 * the rider's whole garage (DISCOVERY = ALL SAVED BIKES), the dealers that can
 * actually reach them, and the union of base services at least one saved bike
 * can be booked for.
 *
 * Three queries, flat: bikes, dealers, AdminService rows. Nothing here scales
 * with the number of services or the number of dealers found.
 */
async function resolveDiscoveryContext(req, res) {
  const { lat, lng, city, bikeId, bikeIds } = req.query

  if (bikeId && !mongoose.Types.ObjectId.isValid(bikeId)) {
    res.status(400).json({ status: false, message: "Invalid bikeId" })
    return null
  }

  const { contexts: bikeContexts } = await resolveDiscoveryBikeContexts({
    userId: req.user_id || null,
    bikeId,
    bikeIds,
  })

  let scope
  try {
    scope = await resolveDealerScope({ lat, lng, city })
  } catch (err) {
    res.status(400).json({ status: false, message: "Invalid lat/lng" })
    return null
  }

  const eligibility = await resolveEligibleServices({ scope, bikeContexts })

  return { bikeContexts, scope, eligibility }
}

// Popularity is a ranking signal, not an eligibility gate — eligibility is
// already enforced by the service-id union. Network scope therefore stays
// network-wide rather than shipping every dealer id on the platform into an
// aggregation $in.
function popularityScopeIds(scope) {
  return scope.kind === "network" ? null : scope.dealerIds
}

// `meta.scope` keeps its original two values so existing clients keep working;
// `meta.scopeKind` carries the finer area/city/network distinction.
function scopeMeta(scope, bikeContexts) {
  return {
    scope: scope.kind === "network" ? "network" : "area",
    scopeKind: scope.kind,
    bikeMatched: bikeContexts.length > 0,
    bikeCount: bikeContexts.length,
    evaluatedBikeIds: bikeContexts.map(ctx => ctx.bikeId),
  }
}

// GET /api/v1/home/quick-services?bikeId=&bikeIds=&lat=&lng=
//
// Cards come from what nearby bookable dealers actually offer for the rider's
// saved bikes — never from a standalone catalog. A card that appears here is
// guaranteed to open onto at least one garage that can take the booking.
async function quickServices(req, res) {
  try {
    const context = await resolveDiscoveryContext(req, res)
    if (context === null) return
    const { bikeContexts, scope, eligibility } = context

    if (!eligibility.serviceIds.length) {
      return res.status(200).json({
        status: true,
        message: "No quick services found",
        data: [],
        meta: scopeMeta(scope, bikeContexts),
      })
    }

    const popularity = await computeServicePopularity(popularityScopeIds(scope))

    const baseServices = await BaseService.find({ _id: { $in: eligibility.serviceIds }, isActive: true })
      .select(SERVICE_CARD_FIELDS)
      .lean()

    const ranked = baseServices
      .map(service => {
        const bucket = eligibility.byServiceId.get(String(service._id))
        return {
          service,
          bucket,
          popularity: popularity.get(String(service._id)) || { count: 0, source: "dealerCount" },
        }
      })
      .sort((a, b) => b.popularity.count - a.popularity.count)
      .slice(0, 8)
      .map(({ service, bucket, popularity: p }) => ({
        ...serializeService(service, req),
        // Indicative only — the payable amount still comes from /pricing/quote.
        basePrice: bucket.minPrice != null ? bucket.minPrice : service.basePrice,
        dealerId: bucket.nearestDealerId,
        distanceKm: bucket.minDistanceKm != null ? Number(bucket.minDistanceKm.toFixed(2)) : null,
        providerCount: bucket.dealerIds.size,
        // Which of the rider's saved bikes this card is actually bookable for.
        // Phase B uses this to label a card and to preselect the bike.
        eligibleBikeIds: Array.from(bucket.eligibleBikeIds),
        popularityCount: p.count,
        popularitySource: p.source,
      }))

    return res.status(200).json({
      status: true,
      message: ranked.length ? "Quick services fetched" : "No quick services found",
      data: ranked,
      meta: scopeMeta(scope, bikeContexts),
    })
  } catch (error) {
    console.error("Error fetching quick services:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

// GET /api/v1/home/recommended?bikeId=&bikeIds=&lat=&lng=
async function recommended(req, res) {
  try {
    const context = await resolveDiscoveryContext(req, res)
    if (context === null) return
    const { bikeContexts, scope, eligibility } = context

    if (!eligibility.serviceIds.length) {
      return res.status(200).json({
        status: true,
        message: "No recommendations available",
        data: [],
        meta: scopeMeta(scope, bikeContexts),
      })
    }

    const services = await BaseService.find({ _id: { $in: eligibility.serviceIds }, isActive: true })
      .select(SERVICE_CARD_FIELDS)
      .lean()

    const popularity = await computeServicePopularity(popularityScopeIds(scope))
    const maxCount = Math.max(1, ...Array.from(popularity.values()).map(p => p.count))

    // Nearest eligible dealer per service already came out of the eligibility
    // pass, so this no longer re-reads AdminService a second time.
    const distances = Array.from(eligibility.byServiceId.values())
      .map(b => b.minDistanceKm)
      .filter(d => d != null)

    // Proximity is scored relative to the farthest service actually in scope,
    // never a fixed 3 km: dealers now set their own service radius, so in an
    // area served mostly by wide-radius garages a hard 3 km scale would flatten
    // every proximity score to 0 and stop it ranking anything.
    const proximityScale = Math.max(DEFAULT_RADIUS_KM, ...distances)
    const bikeMatched = bikeContexts.length > 0

    const ranked = services
      .map(s => {
        const key = String(s._id)
        const bucket = eligibility.byServiceId.get(key)
        const pop = popularity.get(key) || { count: 0, source: "dealerCount" }
        const minDistance = bucket.minDistanceKm
        const popularityScore = pop.count / maxCount
        const proximityScore = minDistance != null ? Math.max(0, 1 - minDistance / proximityScale) : 0
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
          providerCount: bucket.dealerIds.size,
          eligibleBikeIds: Array.from(bucket.eligibleBikeIds),
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    return res.status(200).json({
      status: true,
      message: ranked.length ? "Recommended services fetched" : "No recommendations available",
      data: ranked,
      meta: scopeMeta(scope, bikeContexts),
    })
  } catch (error) {
    console.error("Error fetching recommended services:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

// GET /api/v1/home/most-booked?lat=&lng=&days=&bikeId=&bikeIds=
// `days` windows the booking count (e.g. days=7 for "this week"); omitted = all-time.
async function mostBooked(req, res) {
  try {
    const { days } = req.query
    let sinceDate = null
    if (days !== undefined) {
      const numDays = Number.parseInt(days, 10)
      if (Number.isNaN(numDays) || numDays <= 0) {
        return res.status(400).json({ status: false, message: "days must be a positive integer" })
      }
      sinceDate = new Date(Date.now() - numDays * 24 * 60 * 60 * 1000)
    }

    const context = await resolveDiscoveryContext(req, res)
    if (context === null) return
    const { bikeContexts, scope, eligibility } = context

    const meta = { ...scopeMeta(scope, bikeContexts), windowDays: sinceDate ? Number.parseInt(days, 10) : null }

    if (!eligibility.serviceIds.length) {
      return res.status(200).json({
        status: true,
        message: "No booking data available yet for this area",
        data: [],
        meta,
      })
    }

    const popularity = await computeServicePopularity(popularityScopeIds(scope), sinceDate)
    const eligibleIds = new Set(eligibility.serviceIds)
    const topIds = Array.from(popularity.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .filter(([id]) => eligibleIds.has(String(id)))
      .slice(0, 6)
      .map(([id]) => String(id))

    const services = await BaseService.find({ _id: { $in: topIds }, isActive: true }).select(SERVICE_CARD_FIELDS).lean()
    const byId = new Map(services.map(s => [String(s._id), s]))

    const ranked = topIds
      .filter(id => byId.has(id))
      .map(id => {
        const p = popularity.get(id)
        const bucket = eligibility.byServiceId.get(id)
        return {
          ...serializeService(byId.get(id), req),
          bookingCount: p.source === "bookings" ? p.count : null,
          dealerCount: p.source === "dealerCount" ? p.count : null,
          isFallback: p.source === "dealerCount",
          providerCount: bucket.dealerIds.size,
          eligibleBikeIds: Array.from(bucket.eligibleBikeIds),
        }
      })

    return res.status(200).json({
      status: true,
      message: ranked.length ? "Most booked services fetched" : "No booking data available yet for this area",
      data: ranked,
      meta,
    })
  } catch (error) {
    console.error("Error fetching most-booked services:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

// GET /api/v1/home/top-garages?lat=&lng=&serviceId=&bikeId=&bikeIds=
//
// A garage is listed only when it can actually serve at least one of the
// rider's saved bikes (and the named service, when one is given). No garage
// appears here that BOOK NOW would then refuse.
async function topGarages(req, res) {
  try {
    const { lat, lng, city, serviceId } = req.query
    if (!lat && !lng && !city) {
      return res.status(400).json({ status: false, message: "lat/lng (or city) is required" })
    }
    if (serviceId && !mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ status: false, message: "Invalid serviceId" })
    }

    const context = await resolveDiscoveryContext(req, res)
    if (context === null) return
    const { bikeContexts, scope } = context

    // When a service is named, re-run the union narrowed to it; otherwise the
    // union already computed covers every service.
    const eligibility = serviceId
      ? await resolveEligibleServices({ scope, bikeContexts, baseServiceIds: [serviceId] })
      : context.eligibility

    const eligibleDealerIds = new Set()
    eligibility.byServiceId.forEach(bucket => bucket.dealerIds.forEach(id => eligibleDealerIds.add(id)))

    const dealers = Array.from(eligibleDealerIds)
      .map(id => scope.dealerById.get(id))
      .filter(Boolean)

    const ratingsMap = await getRatingsMap(dealers.map(d => d._id))

    const ranked = dealers
      .map(dealer => {
        const rating = ratingsMap.get(String(dealer._id)) || { averageRating: 0, ratingCount: 0 }
        const distanceKm = scope.distanceByDealerId.get(String(dealer._id))
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
      meta: scopeMeta(scope, bikeContexts),
    })
  } catch (error) {
    console.error("Error fetching top garages:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

module.exports = { quickServices, recommended, mostBooked, topGarages }
