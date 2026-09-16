// Primitives shared by the v1 read paths: distance maths, dealer rating
// rollups, derived service popularity, and the bike/price-row matchers.
//
// The eligibility RULES that compose these — which dealers a user may see,
// which services their bikes can be booked for — deliberately live in exactly
// one place, ./serviceEligibility.js. They used to be duplicated here as
// findNearbyDealers/getCompatibleServiceIds/getAvailableServiceIds, each
// controller applying a slightly different subset; that drift is what let a
// service card open onto an empty garage list.
const RatingSummary = require("../../models/RatingSummary")
const AdminService = require("../../models/adminService")
const Booking = require("../../models/Booking")
const { DEFAULT_SERVICE_RADIUS_KM } = require("../../helper/dealerServiceRadius")

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

module.exports = {
  DEFAULT_RADIUS_KM,
  EXCLUDED_BOOKING_STATUSES,
  calculateDistanceKm,
  getRatingsMap,
  computeServicePopularity,
  matchesBikePriceRow,
  isAdminServiceCompatibleWithBike,
  priceForBike,
}
