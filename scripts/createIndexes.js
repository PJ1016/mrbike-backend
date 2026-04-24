/**
 * Database Performance Optimization Script
 * Run this script to create indexes for better query performance
 */

const mongoose = require('mongoose')
require('dotenv').config()

async function createIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bikedoctor')
    
    console.log('Creating performance indexes...')
    
    // BikeCompany indexes
    await mongoose.connection.db.collection('bikecompanies').createIndex({ name: 1 })
    console.log('✓ BikeCompany name index created')
    
    // BikeModel indexes
    await mongoose.connection.db.collection('bikemodels').createIndex({ company_id: 1 })
    await mongoose.connection.db.collection('bikemodels').createIndex({ company_id: 1, model_name: 1 })
    console.log('✓ BikeModel indexes created')
    
    // BikeVariant indexes
    await mongoose.connection.db.collection('bikevariants').createIndex({ model_id: 1 })
    await mongoose.connection.db.collection('bikevariants').createIndex({ model_id: 1, engine_cc: 1 })
    await mongoose.connection.db.collection('bikevariants').createIndex({ engine_cc: 1 })
    console.log('✓ BikeVariant indexes created')
    
    // AdminService indexes
    await mongoose.connection.db.collection('adminservices').createIndex({ dealer_id: 1 })
    await mongoose.connection.db.collection('adminservices').createIndex({ dealers: 1 })
    await mongoose.connection.db.collection('adminservices').createIndex({ base_service_id: 1 })
    await mongoose.connection.db.collection('adminservices').createIndex({ isActive: 1 })
    await mongoose.connection.db.collection('adminservices').createIndex({ dealer_id: 1, isActive: 1 })
    await mongoose.connection.db.collection('adminservices').createIndex({ dealers: 1, isActive: 1 })
    await mongoose.connection.db.collection('adminservices').createIndex({ createdAt: -1 })
    console.log('✓ AdminService indexes created')
    
    // AdditionalService indexes
    await mongoose.connection.db.collection('additionalservices').createIndex({ dealer_id: 1 })
    await mongoose.connection.db.collection('additionalservices').createIndex({ base_additional_service_id: 1 })
    await mongoose.connection.db.collection('additionalservices').createIndex({ isActive: 1 })
    await mongoose.connection.db.collection('additionalservices').createIndex({ dealer_id: 1, isActive: 1 })
    console.log('✓ AdditionalService indexes created')
    
    // BaseService indexes
    await mongoose.connection.db.collection('baseservices').createIndex({ name: 1 })
    await mongoose.connection.db.collection('baseservices').createIndex({ isActive: 1 })
    console.log('✓ BaseService indexes created')
    
    // Vendor/Dealer indexes
    await mongoose.connection.db.collection('vendors').createIndex({ shopName: 1 })
    await mongoose.connection.db.collection('vendors').createIndex({ email: 1 })
    console.log('✓ Vendor indexes created')
    
    console.log('🚀 All performance indexes created successfully!')
    
  } catch (error) {
    console.error('Error creating indexes:', error)
  } finally {
    await mongoose.connection.close()
  }
}

// Run the script
if (require.main === module) {
  createIndexes()
}

module.exports = createIndexes