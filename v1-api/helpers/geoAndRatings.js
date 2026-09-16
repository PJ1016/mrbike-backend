const Vendor = require("../../models/dealerModel")
const RatingSummary = require("../../models/RatingSummary")
const AdminService = require("../../models/adminService")
const Booking = require("../../models/Booking")
const UserBike = require("../../models/userBikeModel")
const { isDealerBookable } = require("../../helper/dealerStatus")
const {
  DEFAULT_SERVICE_RADIUS_KM,
  getDealerServiceRadiusKm,
  isWithinServiceRadius,
  serviceRadiusBoundingBoxDegrees,
} = require("../../helper/dealerServiceRadius")

// Kept as the fallback reach of a dealer that never configured one, and as the
// normalization constant for proximity scoring. The actual visibility cut-off
// is per-dealer — see helper/dealerServiceRadius.js.
const DEFAULT_RADIUS_KM = DEFAULT_SERVICE_RADIUS_KM

// Bookings in these statuses never reached a completed/paid service, so they
// don't count as real demand signal for "most booked"/"popular" ranking.
const EXCLUDED_BOOKING_STATUSES = [
  "pending",
  "user_cancelled",
  "cancelled",
  "rejected",
  "expired",
]

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Finds bookable dealers that actually serve a lat/lng point, or that sit in a
 * given city (admin-facing fallback when no live coordinates are available).
 * Mirrors the eligibility rules already used by controller/dealer.js#dealerWithInRange.
 *
 * Reach is per-dealer: each garage's own serviceRadiusKm decides whether this
 * user is inside its service area. Pass radiusKm to additionally cap how far
 * the caller is willing to look — the effective cut-off is then the smaller of
 * the two, so a caller can narrow the search but never widen a garage's reach
 * beyond what the garage itself agreed to.
 */
async function findNearbyDealers({ lat, lng, city, radiusKm = null } = {}) {
  const baseFilter = {
    online: true,
    wallet: { $gt: -500 },
    isBlocked: { $ne: true },
  }

  if (city) {
    baseFilter.city = new RegExp(`^${city.trim()}$`, "i")
    const dealers = (await Vendor.find(baseFilter)).filter(isDealerBookable)
    return dealers.map(d => ({ dealer: d, distanceKm: null }))
  }

  const latitude = parseFloat(lat)
  const longitude = parseFloat(lng)
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw new Error("INVALID_COORDINATES")
  }

  // Coarse pre-filter sized off the widest radius any dealer may configure, so
  // a far-reaching garage is never dropped before its own radius is consulted.
  const boxDelta = serviceRadiusBoundingBoxDegrees()

  const dealers = (
    await Vendor.find({
      ...baseFilter,
      latitude: { $gte: latitude - boxDelta, $lte: latitude + boxDelta },
      longitude: { $gte: longitude - boxDelta, $lte: longitude + boxDelta },
    })
  ).filter(isDealerBookable)

  const callerCap = Number(radiusKm)
  const hasCallerCap = Number.isFinite(callerCap) && callerCap > 0

  return dealers
    .map(dealer => ({
      dealer,
      distanceKm: calculateDistanceKm(latitude, longitude, dealer.latitude, dealer.longitude),
      serviceRadiusKm: getDealerServiceRadiusKm(dealer),
    }))
    .filter(entry => isWithinServiceRadius(entry.distanceKm, entry.dealer))
    .filter(entry => !hasCallerCap || entry.distanceKm <= callerCap)
    .sort((a, b) => a.distanceKm - b.distanceKm)
}

/** Reads the maintained dealer rollups in one query (no per-card/N+1 work). */
async function getRatingsMap(dealerIds) {
  if (!dealerIds.length) return new Map()
  const rows = await RatingSummary.find({ entityType: "dealer", entityId: { $in: dealerIds } }).select("entityId averageRating reviewCount").lean()

  const map = new Map()
  rows.forEach(row => {
    map.set(String(row.entityId), {
      averageRating: Number((row.averageRating || 0).toFixed(1)),
      ratingCount: row.reviewCount,
    })
  })
  return map
}

/**
 * Real, derived popularity per BaseService, scoped to a set of dealer ids
 * (or network-wide if dealerIds is null). Prefers actual booking-volume
 * counts; falls back to distinct-dealer-offering-count only when there is no
 * booking history yet for the scope, and flags that fallback so the caller
 * can be honest about it — never a static/invented number either way.
 */
async function computeServicePopularity(dealerIds, sinceDate = null) {
  const dealerMatch = dealerIds ? { dealer_id: { $in: dealerIds } } : {}
  const dateMatch = sinceDate ? { create_date: { $gte: sinceDate } } : {}

  const bookingRows = await Booking.aggregate([
    { $match: { ...dealerMatch, ...dateMatch, status: { $nin: EXCLUDED_BOOKING_STATUSES } } },
    { $unwind: "$services" },
    {
      $lookup: {
        from: AdminService.collection.name,
        localField: "services",
        foreignField: "_id",
        as: "svc",
      },
    },
    { $unwind: "$svc" },
    { $group: { _id: "$svc.base_service_id", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ])

  if (bookingRows.length > 0) {
    const map = new Map()
    bookingRows.forEach(row => map.set(String(row._id), { count: row.count, source: "bookings" }))
    return map
  }

  const dealerCountRows = await AdminService.aggregate([
    { $match: { ...dealerMatch, isActive: true } },
    { $group: { _id: "$base_service_id", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ])

  const map = new Map()
  dealerCountRows.forEach(row => map.set(String(row._id), { count: row.count, source: "dealerCount" }))
  return map
}

/** Resolves a customer's saved bike down to its brand/model/variant/cc. */
async function resolveBikeContext(bikeId) {
  const bike = await UserBike.findById(bikeId).populate({
    path: "variant_id",
    populate: { path: "model_id", populate: { path: "company_id" } },
  })

  if (!bike || !bike.variant_id || !bike.variant_id.model_id || !bike.variant_id.model_id.company_id) {
    return null
  }

  return {
    companyId: bike.variant_id.model_id.company_id._id,
    modelId: bike.variant_id.model_id._id,
    variantId: bike.variant_id._id,
    cc: bike.variant_id.engine_cc,
  }
}

/**
 * A price row is usable only when it can actually be booked for the saved
 * bike.  A missing model/variant is deliberately treated as a dealer-wide
 * price row, but a populated field must match exactly.  This keeps cards,
 * garage lists and booking entry points from advertising a service priced for
 * a different model, variant or engine size.
 */
function matchesBikePriceRow(row, bikeContext) {
  if (!row || !bikeContext) return false
  if (row.model_id && String(row.model_id) !== String(bikeContext.modelId)) return false
  if (row.variant_id && String(row.variant_id) !== String(bikeContext.variantId)) return false
  if (row.cc != null && bikeContext.cc != null && Number(row.cc) !== Number(bikeContext.cc)) return false
  return typeof row.price === "number" && row.price >= 0
}

function isAdminServiceCompatibleWithBike(adminService, bikeContext) {
  if (!adminService || !bikeContext) return false
  const supportsCompany = (adminService.companies || []).some(
    companyId => String(companyId) === String(bikeContext.companyId),
  )
  return supportsCompany && (adminService.bikes || []).some(row => matchesBikePriceRow(row, bikeContext))
}

function priceForBike(adminService, bikeContext) {
  const matches = (adminService.bikes || []).filter(row => matchesBikePriceRow(row, bikeContext))
  if (!matches.length) return null
  // The most specific configured price wins: variant > model > company-wide.
  matches.sort((a, b) => {
    const specificity = row => Number(!!row.model_id) + Number(!!row.variant_id)
    return specificity(b) - specificity(a) || Number(a.price) - Number(b.price)
  })
  return matches[0].price
}

/** Distinct base services that a dealer has priced for this exact bike. */
async function getCompatibleServiceIds(bikeContext, dealerIds = null) {
  if (!bikeContext) return []
  const filter = { isActive: true, companies: bikeContext.companyId }
  if (dealerIds) filter.dealer_id = { $in: dealerIds }
  const services = await AdminService.find(filter).select("base_service_id companies bikes").lean()
  return [...new Set(services
    .filter(service => isAdminServiceCompatibleWithBike(service, bikeContext))
    .map(service => String(service.base_service_id)))]
}

/** Base services currently offered by the eligible dealers in a scope. */
async function getAvailableServiceIds(dealerIds = null) {
  const filter = { isActive: true }
  if (dealerIds) filter.dealer_id = { $in: dealerIds }
  const ids = await AdminService.distinct("base_service_id", filter)
  return ids.map(String)
}

module.exports = {
  DEFAULT_RADIUS_KM,
  EXCLUDED_BOOKING_STATUSES,
  calculateDistanceKm,
  findNearbyDealers,
  getRatingsMap,
  computeServicePopularity,
  resolveBikeContext,
  getCompatibleServiceIds,
  getAvailableServiceIds,
  matchesBikePriceRow,
  isAdminServiceCompatibleWithBike,
  priceForBike,
}
