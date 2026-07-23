/**
 * One-off backfill for the Rich FAQ upgrade.
 *
 * FAQs created before the `appType` field existed have no `appType` in
 * MongoDB at all. Mongoose schema defaults never apply to already-stored
 * documents read via `.lean()` (used throughout the FAQ controllers), so a
 * `{ appType: 'user' }` filter would silently exclude every pre-existing FAQ
 * without this backfill. Setting appType to both keeps old FAQs visible in
 * both apps, matching their behavior before this upgrade.
 *
 * Run once, manually, before deploying the appType-filtered public endpoint:
 *   node scripts/backfillFaqAppType.js
 */

const mongoose = require('mongoose')
require('dotenv').config()
const Faq = require('../models/Faq')

async function backfillFaqAppType() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bikedoctor')

    const result = await Faq.updateMany(
      { appType: { $exists: false } },
      { $set: { appType: ['user', 'dealer'] } }
    )
    console.log(`✓ Backfilled appType on ${result.modifiedCount} FAQ(s)`)
  } catch (error) {
    console.error('Error backfilling FAQ appType:', error)
  } finally {
    await mongoose.connection.close()
  }
}

if (require.main === module) {
  backfillFaqAppType()
}

module.exports = backfillFaqAppType
