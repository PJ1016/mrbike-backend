/**
 * Simple In-Memory Cache for BikeDoctor API
 * Caches frequently accessed data to reduce database queries
 */

class SimpleCache {
  constructor() {
    this.cache = new Map()
    this.ttl = new Map() // Time to live
    this.defaultTTL = 5 * 60 * 1000 // 5 minutes
  }

  set(key, value, ttl = this.defaultTTL) {
    this.cache.set(key, value)
    this.ttl.set(key, Date.now() + ttl)
  }

  get(key) {
    if (!this.cache.has(key)) {
      return null
    }

    const expiry = this.ttl.get(key)
    if (Date.now() > expiry) {
      this.cache.delete(key)
      this.ttl.delete(key)
      return null
    }

    return this.cache.get(key)
  }

  delete(key) {
    this.cache.delete(key)
    this.ttl.delete(key)
  }

  clear() {
    this.cache.clear()
    this.ttl.clear()
  }

  // Clean expired entries
  cleanup() {
    const now = Date.now()
    for (const [key, expiry] of this.ttl.entries()) {
      if (now > expiry) {
        this.cache.delete(key)
        this.ttl.delete(key)
      }
    }
  }

  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

// Create global cache instance
const cache = new SimpleCache()

// Clean up expired entries every 10 minutes
setInterval(() => {
  cache.cleanup()
}, 10 * 60 * 1000)

// Cache key generators
const CacheKeys = {
  bikesByCompany: (companyIds) => `bikes:company:${companyIds}`,
  servicesByDealer: (dealerId) => `services:dealer:${dealerId}`,
  adminService: (serviceId) => `admin:service:${serviceId}`,
  bikeCompanies: () => 'bike:companies:all',
  bikeModels: (companyId) => `bike:models:${companyId}`,
  bikeVariants: (modelId) => `bike:variants:${modelId}`
}

module.exports = {
  cache,
  CacheKeys
}