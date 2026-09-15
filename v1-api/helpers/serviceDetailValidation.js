/**
 * Validation and normalization for the Service Detail CMS write path.
 *
 * Pure — no mongoose, no express, no S3 — so every rule is unit-testable
 * (test/serviceDetailValidation.test.js). HTML sanitization and YouTube
 * normalization are NOT done here: those belong to utils/sanitizeHtml.js and
 * utils/youtube.js, which the controller applies. This module decides shape,
 * ordering and completeness only.
 *
 * Every normalizer returns { value } or { error } so the controller can turn
 * the first failure into a 400 naming the offending field.
 */

const MAX_IMAGES = 12
const MAX_ITEMS = 30
const MAX_FAQS = 30
const MAX_TITLE_LENGTH = 120
const MAX_ITEM_DESCRIPTION_LENGTH = 500
const MAX_QUESTION_LENGTH = 300
const MAX_TEXT_FIELD_LENGTH = 200

const isPlainString = value => typeof value === "string"
const trimmed = value => (isPlainString(value) ? value.trim() : "")

/**
 * True when rich-text HTML carries no actual words. Quill emits "<p><br></p>"
 * for an empty editor, which is not the same as "", so a naive truthiness
 * check would treat an untouched editor as filled-in content.
 */
function isRichTextEmpty(html) {
  if (!html || !isPlainString(html)) return true
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === ""
}

/**
 * Short free-text field (warrantyText, recommendedInterval, shortDescription).
 * `undefined` means "not sent" and leaves the stored value alone; "" is an
 * explicit clear.
 */
function normalizeTextField(value, field, maxLength = MAX_TEXT_FIELD_LENGTH) {
  if (value === undefined) return { value: undefined }
  if (value === null) return { value: "" }
  if (!isPlainString(value)) return { error: `${field} must be a string` }
  const clean = value.trim()
  if (clean.length > maxLength) {
    return { error: `${field} must be ${maxLength} characters or fewer` }
  }
  return { value: clean }
}

/**
 * Estimated duration override. null clears it back to "inherit
 * BaseService.duration" — which is why 0 and null mean different things here.
 */
function normalizeDurationMinutes(value) {
  if (value === undefined) return { value: undefined }
  if (value === null || value === "") return { value: null }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { error: "durationMinutes must be a non-negative number" }
  }
  if (parsed > 24 * 60) {
    return { error: "durationMinutes must be 1440 (24 hours) or fewer" }
  }
  return { value: Math.round(parsed) }
}

/**
 * Gallery normalization.
 *
 * Array position is the ordering source of truth — the admin drags rows, so
 * whatever `order` the client sends is discarded and re-derived from index.
 * That makes reorder idempotent and stops a stale/duplicated `order` from
 * silently scrambling the gallery.
 *
 * Exactly one cover is guaranteed: the first flagged image wins, and if the
 * client flags none, the first image becomes the cover. A gallery can
 * therefore never render without one.
 */
function normalizeImages(images) {
  if (images === undefined) return { value: undefined }
  if (!Array.isArray(images)) return { error: "images must be an array" }
  if (images.length > MAX_IMAGES) return { error: `images cannot exceed ${MAX_IMAGES} entries` }

  const seenUrls = new Set()
  const normalized = []

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index]
    if (!image || typeof image !== "object") {
      return { error: `images[${index}] must be an object` }
    }
    const url = trimmed(image.url)
    if (!url) return { error: `images[${index}].url is required` }
    if (!/^https?:\/\//i.test(url)) {
      return { error: `images[${index}].url must be an absolute http(s) URL` }
    }
    if (seenUrls.has(url)) return { error: `images[${index}].url is duplicated` }
    seenUrls.add(url)

    normalized.push({
      url,
      alt: trimmed(image.alt).slice(0, MAX_TITLE_LENGTH),
      order: index,
      isCover: image.isCover === true,
    })
  }

  const coverIndex = normalized.findIndex(img => img.isCover)
  normalized.forEach((img, index) => {
    img.isCover = index === (coverIndex === -1 ? 0 : coverIndex)
  })

  return { value: normalized }
}

/**
 * Essential items / optional items / benefits all share this shape. `title` is
 * the only required part — an item with no title would render as an empty
 * bullet, so it is rejected rather than silently dropped.
 */
function normalizeContentItems(items, field) {
  if (items === undefined) return { value: undefined }
  if (!Array.isArray(items)) return { error: `${field} must be an array` }
  if (items.length > MAX_ITEMS) return { error: `${field} cannot exceed ${MAX_ITEMS} entries` }

  const normalized = []
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    if (!item || typeof item !== "object") {
      return { error: `${field}[${index}] must be an object` }
    }
    const title = trimmed(item.title)
    if (!title) return { error: `${field}[${index}].title is required` }
    if (title.length > MAX_TITLE_LENGTH) {
      return { error: `${field}[${index}].title must be ${MAX_TITLE_LENGTH} characters or fewer` }
    }
    const description = trimmed(item.description)
    if (description.length > MAX_ITEM_DESCRIPTION_LENGTH) {
      return { error: `${field}[${index}].description must be ${MAX_ITEM_DESCRIPTION_LENGTH} characters or fewer` }
    }
    normalized.push({ title, description, icon: trimmed(item.icon), order: index })
  }
  return { value: normalized }
}

/**
 * FAQ rows. Answers are rich text, so emptiness is judged on text content,
 * not on the HTML string. The controller sanitizes the answer AFTER this
 * runs, so markup that sanitizing would strip entirely still fails the
 * emptiness check below rather than being stored as a blank answer.
 */
function normalizeFaqs(faqs) {
  if (faqs === undefined) return { value: undefined }
  if (!Array.isArray(faqs)) return { error: "faqs must be an array" }
  if (faqs.length > MAX_FAQS) return { error: `faqs cannot exceed ${MAX_FAQS} entries` }

  const normalized = []
  for (let index = 0; index < faqs.length; index += 1) {
    const faq = faqs[index]
    if (!faq || typeof faq !== "object") return { error: `faqs[${index}] must be an object` }
    const question = trimmed(faq.question)
    if (!question) return { error: `faqs[${index}].question is required` }
    if (question.length > MAX_QUESTION_LENGTH) {
      return { error: `faqs[${index}].question must be ${MAX_QUESTION_LENGTH} characters or fewer` }
    }
    if (isRichTextEmpty(faq.answer)) return { error: `faqs[${index}].answer is required` }
    normalized.push({ question, answer: faq.answer, order: index })
  }
  return { value: normalized }
}

/**
 * Gate for Draft → Published.
 *
 * Returns every reason the content isn't publishable, so the admin sees one
 * complete checklist instead of fixing one problem per save. An empty array
 * means publishable. Saving a draft never runs this — only publishing does,
 * which is what stops half-built content reaching the app.
 */
function collectPublishBlockers({ detail, baseService }) {
  const blockers = []

  if (!detail || !Array.isArray(detail.images) || detail.images.length === 0) {
    blockers.push("At least one service image is required")
  } else if (!detail.images.some(img => img.isCover)) {
    blockers.push("A cover image must be selected")
  }

  if (!detail || isRichTextEmpty(detail.fullDescription)) {
    blockers.push("Full description is required")
  }

  if (!trimmed(baseService && baseService.shortDescription)) {
    blockers.push("Short description is required")
  }

  const faqs = (detail && detail.faqs) || []
  faqs.forEach((faq, index) => {
    if (!trimmed(faq.question) || isRichTextEmpty(faq.answer)) {
      blockers.push(`FAQ ${index + 1} is missing a question or answer`)
    }
  })

  const checkItems = (items, label) => {
    ;(items || []).forEach((item, index) => {
      if (!trimmed(item.title)) blockers.push(`${label} ${index + 1} is missing a title`)
    })
  }
  checkItems(detail && detail.essentialItems, "Essential item")
  checkItems(detail && detail.optionalItems, "Optional item")
  checkItems(detail && detail.benefits, "Benefit")

  return blockers
}

module.exports = {
  MAX_IMAGES,
  MAX_ITEMS,
  MAX_FAQS,
  isRichTextEmpty,
  normalizeTextField,
  normalizeDurationMinutes,
  normalizeImages,
  normalizeContentItems,
  normalizeFaqs,
  collectPublishBlockers,
}
