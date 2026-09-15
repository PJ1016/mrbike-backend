/**
 * Phase 1 backfill for the Service Detail system.
 *
 * Populates the four lightweight fields added to BaseService
 * (shortDescription, warrantyText, recommendedInterval, hasDetail) on
 * services that predate them. Mongoose schema defaults never apply to
 * documents already stored in MongoDB, and several service reads use
 * `.lean()`, so without this a legacy service returns `undefined` for these
 * fields rather than the "" / false the schema promises.
 *
 * Safety properties — this script is deliberately boring:
 *   - Additive only. No field is ever removed, renamed or cleared.
 *   - `image`, `description`, `name`, `id`, `_id`, `duration`, `warranty` and
 *     every pricing/booking reference are never written to.
 *   - Only fills fields that are absent or empty, so re-running it cannot
 *     overwrite anything an admin has since authored. Safe to run twice.
 *   - Creates NO ServiceDetail documents. A missing detail row is a supported,
 *     fully-rendering state (see v1-api/helpers/serviceDetail.js#mergeServiceDetail,
 *     which falls back to the base fields and presents the legacy single
 *     `image` as a one-image gallery), so writing an empty row per service
 *     would add documents that carry no information.
 *
 * Usage:
 *   node scripts/backfillServiceDetail.js --dry-run   # report only, no writes
 *   node scripts/backfillServiceDetail.js             # apply
 */

const mongoose = require("mongoose")
require("dotenv").config()
const BaseService = require("../models/baseService")

const SHORT_DESCRIPTION_MAX = 160

/**
 * Derive a one-line summary from an existing free-text description.
 *
 * Descriptions in production are commonly a dash-bulleted list produced by the
 * admin panel's AI generate button, so the first meaningful line is the best
 * available summary. Truncation falls back to a word boundary to avoid
 * cutting mid-word.
 */
function deriveShortDescription(description) {
  if (!description || typeof description !== "string") return ""

  const firstLine = description
    .split("\n")
    .map(line => line.trim().replace(/^[-*•]\s*/, "").trim())
    .find(line => line.length > 0)

  if (!firstLine) return ""
  if (firstLine.length <= SHORT_DESCRIPTION_MAX) return firstLine

  const clipped = firstLine.slice(0, SHORT_DESCRIPTION_MAX)
  const lastSpace = clipped.lastIndexOf(" ")
  return `${(lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`
}

/**
 * Text form of the existing `warranty` boolean. The boolean itself is left
 * exactly as it is — admin UI, list responses and the apps all still read it.
 * A service with warranty=false gets "" rather than "No warranty", so the
 * detail screen hides the chip instead of advertising the absence.
 */
function deriveWarrantyText(warranty) {
  return warranty === true ? "Warranty included" : ""
}

const isBlank = value => value === undefined || value === null || value === ""

/**
 * Builds the $set for one service. Returns null when nothing needs writing,
 * which is what makes a second run a no-op.
 */
function buildUpdate(service) {
  const set = {}

  if (isBlank(service.shortDescription)) {
    const derived = deriveShortDescription(service.description)
    if (derived) set.shortDescription = derived
  }
  if (isBlank(service.warrantyText)) {
    const derived = deriveWarrantyText(service.warranty)
    if (derived) set.warrantyText = derived
  }
  // No source of truth exists for this yet — it is authored by admins in the
  // next phase. Written only so `.lean()` reads return "" instead of undefined.
  if (service.recommendedInterval === undefined) set.recommendedInterval = ""
  // No ServiceDetail content exists yet by definition, so every legacy service
  // starts without a detail page. Flipped to true by the admin publish
  // endpoint in the next phase.
  if (service.hasDetail === undefined) set.hasDetail = false

  return Object.keys(set).length ? set : null
}

async function backfillServiceDetail({ dryRun = false } = {}) {
  const services = await BaseService.find({})
    .select("name description warranty shortDescription warrantyText recommendedInterval hasDetail")
    .lean()

  const operations = []
  const samples = []

  services.forEach(service => {
    const set = buildUpdate(service)
    if (!set) return
    operations.push({ updateOne: { filter: { _id: service._id }, update: { $set: set } } })
    if (samples.length < 5) samples.push({ name: service.name, ...set })
  })

  console.log(`Scanned ${services.length} base service(s)`)
  console.log(`${operations.length} need backfilling, ${services.length - operations.length} already current`)

  if (samples.length) {
    console.log("\nSample of what will be written:")
    samples.forEach(s => console.log(" ", JSON.stringify(s)))
  }

  if (dryRun) {
    console.log("\n[dry-run] No changes written.")
    return { scanned: services.length, updated: 0, dryRun: true }
  }

  if (!operations.length) {
    console.log("\n✓ Nothing to do — all base services already have these fields.")
    return { scanned: services.length, updated: 0, dryRun: false }
  }

  const result = await BaseService.bulkWrite(operations, { ordered: false })
  const updated = result.modifiedCount ?? result.nModified ?? 0
  console.log(`\n✓ Backfilled ${updated} base service(s)`)
  return { scanned: services.length, updated, dryRun: false }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/bikedoctor")
    await backfillServiceDetail({ dryRun })
  } catch (error) {
    console.error("Error backfilling service detail fields:", error)
    process.exitCode = 1
  } finally {
    await mongoose.connection.close()
  }
}

if (require.main === module) {
  main()
}

module.exports = { backfillServiceDetail, buildUpdate, deriveShortDescription, deriveWarrantyText }
