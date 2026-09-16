const mongoose = require("mongoose")
const BaseService = require("../../models/baseService")
const AdminService = require("../../models/adminService")
const { isDealerBookable } = require("../../helper/dealerStatus")
const { getRatingsMap, calculateDistanceKm, resolveBikeContext, getCompatibleServiceIds } = require("../helpers/geoAndRatings")
const { getDealerServiceRadiusKm, isWithinServiceRadius } = require("../../helper/dealerServiceRadius")
const ServiceDetail = require("../../models/serviceDetail")
const { computeFromPrice, countProviders, mergeServiceDetail } = require("../helpers/serviceDetail")

function formatImage(url, req) {
  if (url && !url.startsWith("http")) {
    return `${req.protocol}://${req.get("host")}/${url}`
  }
  return url
}

// GET /api/v1/services?categoryId=&bikeId=
async function listByCategory(req, res) {
  try {
    const { categoryId, bikeId } = req.query
    const filter = { isActive: true }

    if (categoryId) {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        return res.status(400).json({ status: false, message: "Invalid categoryId" })
      }
      filter.categoryId = categoryId
    }

    let bikeMatched = false
    if (bikeId) {
      if (!mongoose.Types.ObjectId.isValid(bikeId)) {
        return res.status(400).json({ status: false, message: "Invalid bikeId" })
      }
      const bikeContext = await resolveBikeContext(bikeId)
      if (bikeContext) {
        const allowedServiceIds = await getCompatibleServiceIds(bikeContext)
        filter._id = { $in: allowedServiceIds }
        bikeMatched = true
      }
    }

    // Same guard as homeController's SERVICE_CARD_FIELDS: this list must never
    // start carrying Service Detail content just because a field was added to
    // BaseService. Detail content lives in `servicedetails` and is read only by
    // getServiceById below.
    const services = await BaseService.find(filter)
      .select("name image description categoryId basePrice duration pickupAvailable warranty")
      .populate("categoryId", "name icon")
      .sort({ name: 1 })

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
      meta: { bikeMatched },
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
        // adminServiceId is what POST /pricing/quote takes as `serviceIds`
        // (it resolves AdminService docs, not BaseService ids). Returning it
        // here is what lets the provider list hand the booking screen a
        // priceable id directly, instead of re-querying every dealer's full
        // service list one call at a time.
        return { adminServiceId: svc._id, dealer: svc.dealer_id, price }
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

        // A garage only serves users inside its own radius (serviceRadiusKm,
        // default 3 km), so one that can't reach this user must not appear in
        // the compare list either. Without live coordinates there is nothing to
        // measure against, and the full list is returned as before.
        entries = entries.filter(e =>
          isWithinServiceRadius(distanceById.get(String(e.dealer._id)), e.dealer),
        )
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
          serviceRadiusKm: getDealerServiceRadiusKm(e.dealer),
          price: e.price,
          averageRating: rating.averageRating,
          ratingCount: rating.ratingCount,
          providesPickup: !!e.dealer.providesPickup,
          providesDrop: !!e.dealer.providesDrop,
          // A bike declared NOT_RIDEABLE/COMPLETELY_DEAD has to be towed, so
          // the app can only offer garages that actually tow. Exposed here so
          // that filter is applied against real dealer capability rather than
          // guessed at client-side.
          providesTowing: !!e.dealer.providesTowing,
          towingCharges: e.dealer.towingCharges ?? 0,
          adminServiceId: e.adminServiceId,
          shopImages: (e.dealer.shopImages || []).map(url => formatImage(url, req)),
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


// Dealer fields the eligibility rules actually read — isDealerBookable()
// (helper/dealerStatus.js) plus the service-radius check. Projected rather
// than pulling whole dealer documents, because this endpoint only ever counts
// providers and prices them; it never renders a garage.
const PROVIDER_DEALER_FIELDS =
  "isBlocked online dealerStatus registrationStatus status isActive isDoc latitude longitude serviceRadiusKm"

// GET /api/v1/services/:id?lat=&lng=&variant_id=&cc=
//
// The Service Detail screen's single read: BaseService merged with its
// optional ServiceDetail content, plus the two numbers the screen puts next
// to BOOK NOW — the cheapest available price and how many garages can
// actually take the booking.
//
// Provider eligibility deliberately reuses isDealerBookable() and
// isWithinServiceRadius() unchanged, so providerCount always agrees with the
// list GET /api/v1/services/:id/garages returns for the same coordinates.
// `fromPrice` is indicative only — the payable amount still comes solely from
// /pricing/quote (services/pricingEngine.js).
async function getServiceById(req, res) {
  try {
    const { id } = req.params
    const { lat, lng, variant_id, cc } = req.query

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: false, message: "Invalid service id" })
    }
    if (variant_id && !mongoose.Types.ObjectId.isValid(variant_id)) {
      return res.status(400).json({ status: false, message: "Invalid variant_id" })
    }

    const baseService = await BaseService.findOne({ _id: id, isActive: true }).populate("categoryId", "name icon")
    if (!baseService) {
      return res.status(404).json({ status: false, message: "Service not found" })
    }

    // A service with no detail row (every service does, until admins author
    // content) is not an error — the merge falls back to the base fields.
    const detail = await ServiceDetail.findOne({ baseServiceId: id }).lean()

    const adminServices = await AdminService.find({ base_service_id: id, isActive: true })
      .select("dealer_id bikes")
      .populate("dealer_id", PROVIDER_DEALER_FIELDS)
      .lean()

    let eligible = adminServices.filter(svc => svc.dealer_id && isDealerBookable(svc.dealer_id))

    // With live coordinates, drop garages whose own radius can't reach the
    // user — identical to the rule garagesForService applies, so the count
    // shown here matches the list BOOK NOW opens. Without coordinates there is
    // nothing to measure against and every bookable garage counts.
    const latitude = Number.parseFloat(lat)
    const longitude = Number.parseFloat(lng)
    const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude)
    if (hasCoords) {
      eligible = eligible.filter(svc =>
        isWithinServiceRadius(
          calculateDistanceKm(latitude, longitude, svc.dealer_id.latitude, svc.dealer_id.longitude),
          svc.dealer_id,
        ),
      )
    }

    const ccFilter = cc !== undefined && cc !== "" ? Number.parseInt(cc, 10) : null
    const priceOptions = { variantId: variant_id || null, cc: Number.isNaN(ccFilter) ? null : ccFilter }

    const service = mergeServiceDetail(baseService, detail, {
      formatUrl: url => formatImage(url, req),
    })

    return res.status(200).json({
      status: true,
      message: "Service fetched",
      data: {
        ...service,
        fromPrice: computeFromPrice(eligible, priceOptions),
        providerCount: countProviders(eligible),
      },
      meta: { scope: hasCoords ? "area" : "network" },
    })
  } catch (error) {
    console.error("Error fetching service detail:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

module.exports = { listByCategory, garagesForService, getServiceById }
