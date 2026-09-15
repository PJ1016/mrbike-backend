/**
 * Admin CMS for Service Detail content (Phase 2).
 *
 * Every route here is admin-authenticated (requireAdmin) and writes ONLY to
 * the `servicedetails` collection plus the three lightweight Phase 1 fields on
 * BaseService. It deliberately never touches AdminService, Booking, pricing
 * or any existing BaseService field (name, image, description, basePrice,
 * duration, warranty, categoryId, isActive) — those keep their existing
 * endpoints as their sole writers.
 */

const mongoose = require("mongoose")
const BaseService = require("../../models/baseService")
const ServiceDetail = require("../../models/serviceDetail")
const { createS3Upload, deleteS3Object } = require("../../utils/s3Upload")
const { sanitizeRichText } = require("../../utils/sanitizeHtml")
const { toYoutubeEmbedUrl } = require("../../utils/youtube")
const { mergeServiceDetail } = require("../helpers/serviceDetail")
const {
  MAX_IMAGES,
  isRichTextEmpty,
  normalizeTextField,
  normalizeDurationMinutes,
  normalizeImages,
  normalizeContentItems,
  normalizeFaqs,
  collectPublishBlockers,
} = require("../helpers/serviceDetailValidation")

// Images only — the shared default also permits .pdf, which is meaningless in
// a service gallery. Video is intentionally not accepted here; see
// utils/s3Upload.js and the videoUrl field for why service video is YouTube.
const serviceMediaUpload = createS3Upload("service-detail-media", {
  allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
  maxFileSizeBytes: 10 * 1024 * 1024,
})

function badRequest(res, message) {
  return res.status(400).json({ status: false, message })
}

/**
 * Normalizes the optional YouTube URL. Mirrors faqController.parseVideoUrl so
 * both content types accept exactly the same set of URLs and store exactly
 * the same canonical embed form.
 */
function parseVideoUrl(videoUrl) {
  if (videoUrl === undefined) return { value: undefined }
  if (videoUrl === null || videoUrl === "") return { value: null }
  const embedUrl = toYoutubeEmbedUrl(videoUrl)
  if (!embedUrl) return { error: "videoUrl must be a valid YouTube watch, short, or embed URL" }
  return { value: embedUrl }
}

async function loadBaseService(id, res) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    badRequest(res, "Invalid service id")
    return null
  }
  const baseService = await BaseService.findById(id)
  if (!baseService) {
    res.status(404).json({ status: false, message: "Service not found" })
    return null
  }
  return baseService
}

/**
 * Keeps BaseService.hasDetail in step with whether published content exists.
 * This is the flag list/card responses read, so it must never drift from the
 * detail's own isPublished.
 */
async function syncHasDetail(baseServiceId, isPublished) {
  await BaseService.updateOne({ _id: baseServiceId }, { $set: { hasDetail: !!isPublished } })
}

function detailResponse(baseService, detail) {
  return {
    serviceId: baseService._id,
    name: baseService.name,
    // Phase 1 lightweight fields live on BaseService so lists can render them
    // without touching this collection; surfaced here so the editor can load
    // and save the whole form from one place.
    shortDescription: baseService.shortDescription || "",
    warrantyText: baseService.warrantyText || "",
    recommendedInterval: baseService.recommendedInterval || "",
    duration: baseService.duration,
    image: baseService.image,
    hasDetail: !!baseService.hasDetail,
    detail: detail
      ? {
          fullDescription: detail.fullDescription || "",
          durationMinutes: detail.durationMinutes ?? null,
          videoUrl: detail.videoUrl || null,
          images: (detail.images || []).slice().sort((a, b) => a.order - b.order),
          essentialItems: (detail.essentialItems || []).slice().sort((a, b) => a.order - b.order),
          optionalItems: (detail.optionalItems || []).slice().sort((a, b) => a.order - b.order),
          benefits: (detail.benefits || []).slice().sort((a, b) => a.order - b.order),
          faqs: (detail.faqs || []).slice().sort((a, b) => a.order - b.order),
          isPublished: !!detail.isPublished,
          updatedAt: detail.updatedAt,
        }
      : null,
  }
}

/**
 * GET /api/v1/admin/services/:id/detail
 * Loads the editor. Returns detail: null when no content has been authored —
 * a supported state, not an error, and never auto-creates a row.
 */
async function getServiceDetail(req, res) {
  try {
    const baseService = await loadBaseService(req.params.id, res)
    if (!baseService) return undefined

    const detail = await ServiceDetail.findOne({ baseServiceId: baseService._id }).lean()
    return res.status(200).json({
      status: true,
      message: "Service detail fetched",
      data: detailResponse(baseService, detail),
    })
  } catch (error) {
    console.error("Error fetching service detail (admin):", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

/**
 * GET /api/v1/admin/services/:id/detail/preview
 * Exactly what the user app's GET /api/v1/services/:id would return, but with
 * unpublished content included — so an admin previews the real merged shape
 * (same helper, same fallbacks) rather than a separate approximation that
 * could drift from it.
 */
async function previewServiceDetail(req, res) {
  try {
    const baseService = await loadBaseService(req.params.id, res)
    if (!baseService) return undefined

    await baseService.populate("categoryId", "name icon")
    const detail = await ServiceDetail.findOne({ baseServiceId: baseService._id }).lean()

    const merged = mergeServiceDetail(baseService, detail, {
      formatUrl: url => (url && !url.startsWith("http") ? `${req.protocol}://${req.get("host")}/${url}` : url),
      includeUnpublished: true,
    })

    return res.status(200).json({
      status: true,
      message: "Service detail preview",
      data: merged,
      meta: {
        isPublished: !!(detail && detail.isPublished),
        publishBlockers: collectPublishBlockers({ detail, baseService }),
      },
    })
  } catch (error) {
    console.error("Error previewing service detail:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

/**
 * PUT /api/v1/admin/services/:id/detail
 *
 * Single upsert for the whole editor. Uses findOneAndUpdate with upsert so a
 * double-submit (or two admins saving at once) can never produce a second
 * detail row for the same service — the unique index on baseServiceId backs
 * that up at the database level.
 *
 * Partial by design: a field that isn't sent is left exactly as stored, so
 * saving one tab never blanks another.
 */
async function upsertServiceDetail(req, res) {
  try {
    const baseService = await loadBaseService(req.params.id, res)
    if (!baseService) return undefined

    const body = req.body || {}

    // ── BaseService lightweight fields ────────────────────────────────────
    const baseUpdates = {}
    for (const [field, maxLength] of [
      ["shortDescription", 300],
      ["warrantyText", 200],
      ["recommendedInterval", 200],
    ]) {
      const parsed = normalizeTextField(body[field], field, maxLength)
      if (parsed.error) return badRequest(res, parsed.error)
      if (parsed.value !== undefined) baseUpdates[field] = parsed.value
    }

    // ── ServiceDetail fields ──────────────────────────────────────────────
    const detailUpdates = {}

    if (body.fullDescription !== undefined) {
      if (body.fullDescription !== null && typeof body.fullDescription !== "string") {
        return badRequest(res, "fullDescription must be a string")
      }
      // Sanitize before storing: the admin editor is trusted, but stored HTML
      // is rendered by three clients, so the allowlist is enforced server-side
      // rather than relying on the editor to behave.
      detailUpdates.fullDescription = body.fullDescription ? sanitizeRichText(body.fullDescription) : ""
    }

    const video = parseVideoUrl(body.videoUrl)
    if (video.error) return badRequest(res, video.error)
    if (video.value !== undefined) detailUpdates.videoUrl = video.value

    const duration = normalizeDurationMinutes(body.durationMinutes)
    if (duration.error) return badRequest(res, duration.error)
    if (duration.value !== undefined) detailUpdates.durationMinutes = duration.value

    const images = normalizeImages(body.images)
    if (images.error) return badRequest(res, images.error)
    if (images.value !== undefined) detailUpdates.images = images.value

    for (const field of ["essentialItems", "optionalItems", "benefits"]) {
      const parsed = normalizeContentItems(body[field], field)
      if (parsed.error) return badRequest(res, parsed.error)
      if (parsed.value !== undefined) detailUpdates[field] = parsed.value
    }

    const faqs = normalizeFaqs(body.faqs)
    if (faqs.error) return badRequest(res, faqs.error)
    if (faqs.value !== undefined) {
      detailUpdates.faqs = faqs.value.map(faq => ({ ...faq, answer: sanitizeRichText(faq.answer) }))
      // A sanitized answer that lost all its text (e.g. the admin pasted only
      // a <script>) must not be stored as a blank FAQ.
      const emptied = detailUpdates.faqs.findIndex(faq => isRichTextEmpty(faq.answer))
      if (emptied !== -1) return badRequest(res, `faqs[${emptied}].answer has no usable content`)
    }

    detailUpdates.updatedBy = req.admin_id || null

    if (Object.keys(baseUpdates).length) {
      await BaseService.updateOne({ _id: baseService._id }, { $set: baseUpdates })
      Object.assign(baseService, baseUpdates)
    }

    const detail = await ServiceDetail.findOneAndUpdate(
      { baseServiceId: baseService._id },
      { $set: detailUpdates, $setOnInsert: { baseServiceId: baseService._id, isPublished: false } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean()

    // Publishing is a separate, explicitly-gated action — but if this service
    // is already live, its content just changed, and hasDetail must stay true.
    await syncHasDetail(baseService._id, detail.isPublished)

    return res.status(200).json({
      status: true,
      message: "Service detail saved",
      data: detailResponse(baseService, detail),
    })
  } catch (error) {
    console.error("Error saving service detail:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

/**
 * PATCH /api/v1/admin/services/:id/detail/publish  { isPublished: boolean }
 *
 * The only route that can make content live. Publishing runs the completeness
 * checklist and refuses with every blocker at once; unpublishing is always
 * allowed so a bad page can be pulled instantly.
 */
async function setPublishState(req, res) {
  try {
    const baseService = await loadBaseService(req.params.id, res)
    if (!baseService) return undefined

    const { isPublished } = req.body || {}
    if (typeof isPublished !== "boolean") {
      return badRequest(res, "isPublished must be a boolean")
    }

    const detail = await ServiceDetail.findOne({ baseServiceId: baseService._id }).lean()
    if (!detail) {
      return badRequest(res, "Add service detail content before publishing")
    }

    if (isPublished) {
      const blockers = collectPublishBlockers({ detail, baseService })
      if (blockers.length) {
        return res.status(400).json({
          status: false,
          message: "Service detail is incomplete and cannot be published",
          blockers,
        })
      }
    }

    const updated = await ServiceDetail.findOneAndUpdate(
      { baseServiceId: baseService._id },
      { $set: { isPublished, updatedBy: req.admin_id || null } },
      { new: true },
    ).lean()

    await syncHasDetail(baseService._id, isPublished)

    return res.status(200).json({
      status: true,
      message: isPublished ? "Service detail published" : "Service detail moved to draft",
      data: detailResponse(baseService, updated),
    })
  } catch (error) {
    console.error("Error changing service detail publish state:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

/**
 * POST /api/v1/admin/services/:id/detail/media   (multipart, field "images")
 *
 * Uploads to S3 and appends to the gallery. Returns the full normalized image
 * list so the editor re-renders from server truth rather than guessing what
 * the order became.
 */
async function uploadServiceMedia(req, res) {
  try {
    const baseService = await loadBaseService(req.params.id, res)
    if (!baseService) return undefined

    const files = req.files || []
    if (!files.length) return badRequest(res, "At least one image file is required")

    const detail = await ServiceDetail.findOne({ baseServiceId: baseService._id }).lean()
    const existing = (detail && detail.images) || []

    if (existing.length + files.length > MAX_IMAGES) {
      // Files are already in S3 at this point, so clean them up rather than
      // leaving objects nothing references.
      await Promise.all(files.map(file => deleteS3Object(file.location)))
      return badRequest(res, `A service can have at most ${MAX_IMAGES} images`)
    }

    const combined = [...existing, ...files.map(file => ({ url: file.location, alt: "", isCover: false }))]
    const normalized = normalizeImages(combined)
    if (normalized.error) return badRequest(res, normalized.error)

    const updated = await ServiceDetail.findOneAndUpdate(
      { baseServiceId: baseService._id },
      {
        $set: { images: normalized.value, updatedBy: req.admin_id || null },
        $setOnInsert: { baseServiceId: baseService._id, isPublished: false },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean()

    return res.status(201).json({
      status: true,
      message: `${files.length} image(s) uploaded`,
      data: { images: updated.images.slice().sort((a, b) => a.order - b.order) },
    })
  } catch (error) {
    console.error("Error uploading service media:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

/**
 * DELETE /api/v1/admin/services/:id/detail/media   { url }
 *
 * Removes the image from the gallery and then from S3, so the bucket doesn't
 * accumulate orphans. BaseService.image is explicitly protected: it is the
 * cover every legacy consumer (bookings, invoices, dealer app, list
 * endpoints) still reads, and it is not this route's to delete.
 */
async function deleteServiceMedia(req, res) {
  try {
    const baseService = await loadBaseService(req.params.id, res)
    if (!baseService) return undefined

    const url = (req.body && req.body.url ? String(req.body.url) : "").trim()
    if (!url) return badRequest(res, "url is required")

    if (baseService.image && baseService.image === url) {
      return badRequest(res, "This image is the service's main image and cannot be deleted here")
    }

    const detail = await ServiceDetail.findOne({ baseServiceId: baseService._id }).lean()
    if (!detail || !(detail.images || []).some(img => img.url === url)) {
      return res.status(404).json({ status: false, message: "Image not found on this service" })
    }

    const remaining = normalizeImages(detail.images.filter(img => img.url !== url))
    if (remaining.error) return badRequest(res, remaining.error)

    const updated = await ServiceDetail.findOneAndUpdate(
      { baseServiceId: baseService._id },
      { $set: { images: remaining.value, updatedBy: req.admin_id || null } },
      { new: true },
    ).lean()

    // DB first, S3 second: a failed S3 delete is logged, never thrown
    // (deleteS3Object swallows), so a bucket hiccup can't leave the gallery
    // pointing at an image the admin already removed.
    await deleteS3Object(url)

    return res.status(200).json({
      status: true,
      message: "Image deleted",
      data: { images: updated.images.slice().sort((a, b) => a.order - b.order) },
    })
  } catch (error) {
    console.error("Error deleting service media:", error)
    return res.status(500).json({ status: false, message: "Internal Server Error" })
  }
}

module.exports = {
  serviceMediaUpload,
  getServiceDetail,
  previewServiceDetail,
  upsertServiceDetail,
  setPublishState,
  uploadServiceMedia,
  deleteServiceMedia,
}
