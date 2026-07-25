/**
 * One-off bulk insert of default service categories.
 *
 * Backs up the current ServiceCategory collection to JSON, then prints the
 * exact documents it would insert (skipping any name that already exists).
 * Only writes to the DB when run with --confirm — otherwise it's a dry run.
 *
 * Usage:
 *   node scripts/seedServiceCategories.js            # dry run (backup + preview only)
 *   node scripts/seedServiceCategories.js --confirm   # actually insert
 */

const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const ServiceCategory = require('../models/serviceCategoryModel')

const CATEGORIES_TO_SEED = [
  { name: 'General Service', icon: 'wrench' },
  { name: 'Oil Change', icon: 'oil' },
  { name: 'Brake Service', icon: 'car-brake-alert' },
  { name: 'Chain Cleaning', icon: 'link-variant' },
  { name: 'Tyre Repair', icon: 'tire' },
  { name: 'Bike Wash', icon: 'car-wash' },
  { name: 'Pickup & Drop', icon: 'truck-fast' },
  { name: 'Insurance', icon: 'shield-check' },
  { name: 'Emergency', icon: 'ambulance' },
  { name: 'Accessories', icon: 'shopping' },
]

async function seedServiceCategories() {
  const shouldWrite = process.argv.includes('--confirm')

  try {
    await mongoose.connect(process.env.DATABASE_URL)

    const existing = await ServiceCategory.find({}).sort({ sortOrder: 1, name: 1 }).lean()

    const backupPath = path.join(
      __dirname,
      `serviceCategory_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    )
    fs.writeFileSync(backupPath, JSON.stringify(existing, null, 2))
    console.log(`Backed up ${existing.length} existing ServiceCategory document(s) to ${backupPath}`)

    const existingNames = new Set(existing.map(c => c.name))
    const maxSortOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder ?? 0), -1)

    const toInsert = CATEGORIES_TO_SEED.filter(c => !existingNames.has(c.name)).map((c, i) => ({
      name: c.name,
      icon: c.icon,
      sortOrder: maxSortOrder + 1 + i,
      isActive: true,
    }))

    const skipped = CATEGORIES_TO_SEED.filter(c => existingNames.has(c.name)).map(c => c.name)

    console.log('\n--- DRY RUN: documents that would be inserted ---')
    console.log(JSON.stringify(toInsert, null, 2))
    if (skipped.length) {
      console.log(`\nSkipping (already exist): ${skipped.join(', ')}`)
    }
    console.log(`\n${toInsert.length} document(s) to insert. Existing count: ${existing.length}.`)

    if (!shouldWrite) {
      console.log('\nDry run only — re-run with --confirm to actually insert.')
      return
    }

    if (toInsert.length === 0) {
      console.log('\nNothing to insert.')
      return
    }

    const inserted = await ServiceCategory.insertMany(toInsert)
    console.log(`\n✓ Inserted ${inserted.length} service categor${inserted.length === 1 ? 'y' : 'ies'}.`)
    console.log(JSON.stringify(inserted, null, 2))
  } catch (error) {
    console.error('Error seeding service categories:', error)
  } finally {
    await mongoose.connection.close()
  }
}

if (require.main === module) {
  seedServiceCategories()
}

module.exports = seedServiceCategories
