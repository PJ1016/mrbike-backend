/**
 * Pure helpers behind GET /api/v1/services/:id.
 *
 * Deliberately free of mongoose and express so the merge rules, the
 * "from ₹" floor and the provider tally can be unit-tested without a DB
 * (test/serviceDetail.test.js). The controller does the querying and the
 * dealer-eligibility filtering; everything decision-shaped lives here.
 */

/**
 * Price this dealer's offering of the service for the requested bike.
 *
 * Mirrors the rule garagesForService already applies, so the "from ₹" on the
 * detail screen can never disagree with the cheapest row in the compare list
 * the BOOK NOW button opens:
 *   - with a variant, use that variant's row (optionally pinned to a cc)
 *   - without one, use the dealer's cheapest row as an indicative floor
 * Returns null when this dealer has no usable price, which keeps them out of
 * the floor calculation.
 *
 * This is display-only. The payable amount still comes exclusively from
 * services/pricingEngine.js via /pricing/quote.
 */
function resolveAdminServicePrice(adminService, { variantId = null, cc = null } = {}) {
  const bikes = Array.isArray(adminService?.bikes) ? adminService.bikes : []

  if (variantId) {
    const match = bikes.find(
      b =>
        b.variant_id &&
        String(b.variant_id) === String(variantId) &&
        (cc === null || cc === undefined || b.cc === cc),
    )
    return match && typeof match.price === "number" ? match.price : null
  }

  const prices = bikes.map(b => b.price).filter(p => typeof p === "number")
  return prices.length ? Math.min(...prices) : null
}

/**
 * Lowest price across every eligible dealer, or null when nobody has one.
 * Rendered as "From ₹X"; null must render as an absent price, never ₹0.
 */
function computeFromPrice(adminServices, options = {}) {
  const prices = (adminServices || [])
    .map(svc => resolveAdminServicePrice(svc, options))
    .filter(p => typeof p === "number")
  return prices.length ? Math.min(...prices) : null
}

/**
 * How many distinct dealers can actually be booked for this service.
 * Counts dealers, not AdminService rows: one dealer with several priced rows
 * is still one provider on the screen.
 */
function countProviders(adminServices) {
  const dealerIds = new Set()
  ;(adminServices || []).forEach(svc => {
    if (svc && svc.dealer_id) dealerIds.add(String(svc.dealer_id._id || svc.dealer_id))
  })
  return dealerIds.size
}

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0)

function sortItems(items) {
  return [...(items || [])].sort(byOrder).map(item => ({
    title: item.title,
    description: item.description || "",
    icon: item.icon || "",
  }))
}

/**
 * Gallery for the detail screen.
 *
 * A service with no ServiceDetail content still has to render something, so
 * the legacy single `image` is presented as a one-image gallery. That keeps
 * every pre-existing service looking correct on day one of the new screen.
 */
function buildImages(baseService, detail, formatUrl) {
  const stored = [...((detail && detail.images) || [])].sort(byOrder)
  if (stored.length) {
    return stored.map(img => ({
      url: formatUrl(img.url),
      alt: img.alt || "",
      isCover: !!img.isCover,
    }))
  }
  if (baseService.image) {
    return [{ url: formatUrl(baseService.image), alt: baseService.name || "", isCover: true }]
  }
  return []
}

/**
 * Merge a BaseService with its (optional) ServiceDetail into the detail-screen
 * payload.
 *
 * Two rules matter most:
 *   - A missing or unpublished ServiceDetail is not an error. The endpoint
 *     degrades to the base fields so all pre-existing services keep working.
 *   - Detail values override base values only when actually set, so an empty
 *     content row can never blank out copy the base service already has.
 *
 * `includeUnpublished` exists for the admin preview endpoint in the next
 * phase; the public route always leaves it false.
 */
function mergeServiceDetail(baseService, detail, { formatUrl = url => url, includeUnpublished = false } = {}) {
  const usableDetail = detail && (includeUnpublished || detail.isPublished) ? detail : null

  const category = baseService.categoryId && baseService.categoryId._id
    ? {
        id: baseService.categoryId._id,
        name: baseService.categoryId.name,
        icon: formatUrl(baseService.categoryId.icon),
      }
    : null

  const images = buildImages(baseService, usableDetail, formatUrl)
  const cover = images.find(img => img.isCover) || images[0] || null

  return {
    serviceId: baseService._id,

    // ── Unchanged base fields — same names and meanings as /api/v1/services ──
    name: baseService.name,
    image: formatUrl(baseService.image),
    description: baseService.description || "",
    category,
    basePrice: baseService.basePrice,
    duration: baseService.duration,
    pickupAvailable: !!baseService.pickupAvailable,
    warranty: !!baseService.warranty,

    // ── Detail-screen fields ────────────────────────────────────────────────
    shortDescription: baseService.shortDescription || "",
    fullDescription: (usableDetail && usableDetail.fullDescription) || baseService.description || "",
    coverImage: cover ? cover.url : formatUrl(baseService.image),
    images,
    videoUrl: (usableDetail && usableDetail.videoUrl) || null,
    durationMinutes:
      usableDetail && usableDetail.durationMinutes != null
        ? usableDetail.durationMinutes
        : baseService.duration ?? null,
    warrantyText: (usableDetail && usableDetail.warrantyText) || baseService.warrantyText || "",
    recommendedInterval:
      (usableDetail && usableDetail.recommendedInterval) || baseService.recommendedInterval || "",
    essentialItems: sortItems(usableDetail && usableDetail.essentialItems),
    optionalItems: sortItems(usableDetail && usableDetail.optionalItems),
    benefits: sortItems(usableDetail && usableDetail.benefits),
    faqs: [...((usableDetail && usableDetail.faqs) || [])].sort(byOrder).map(f => ({
      question: f.question,
      answer: f.answer,
    })),

    // True only when there is real published content behind this service, so
    // the client can choose between the rich layout and the compact one.
    hasDetail: !!usableDetail,
  }
}

module.exports = {
  resolveAdminServicePrice,
  computeFromPrice,
  countProviders,
  mergeServiceDetail,
}
