/**
 * Performance Monitoring Middleware
 * Tracks API response times and logs slow queries
 */

const mongoose = require('mongoose')

class PerformanceMonitor {
  constructor() {
    this.slowQueryThreshold = 1000 // 1 second
    this.stats = {
      totalRequests: 0,
      slowQueries: 0,
      averageResponseTime: 0,
      endpoints: new Map()
    }
  }

  // Middleware to track request performance
  trackRequest() {
    return (req, res, next) => {
      const startTime = Date.now()
      const originalSend = res.send

      res.send = function(data) {
        const endTime = Date.now()
        const responseTime = endTime - startTime
        
        // Update stats
        this.updateStats(req.path, responseTime)
        
        // Log slow queries
        if (responseTime > this.slowQueryThreshold) {
          console.warn(`🐌 SLOW QUERY DETECTED:`, {
            endpoint: req.path,
            method: req.method,
            responseTime: `${responseTime}ms`,
            query: req.query,
            body: req.body
          })
        }

        return originalSend.call(this, data)
      }.bind(this)

      next()
    }.bind(this)
  }

  updateStats(endpoint, responseTime) {
    this.stats.totalRequests++
    
    // Update endpoint-specific stats
    if (!this.stats.endpoints.has(endpoint)) {
      this.stats.endpoints.set(endpoint, {
        count: 0,
        totalTime: 0,
        averageTime: 0,
        slowCount: 0
      })
    }
    
    const endpointStats = this.stats.endpoints.get(endpoint)
    endpointStats.count++
    endpointStats.totalTime += responseTime
    endpointStats.averageTime = endpointStats.totalTime / endpointStats.count
    
    if (responseTime > this.slowQueryThreshold) {
      endpointStats.slowCount++
      this.stats.slowQueries++
    }
    
    // Update global average
    const totalTime = Array.from(this.stats.endpoints.values())
      .reduce((sum, stat) => sum + stat.totalTime, 0)
    this.stats.averageResponseTime = totalTime / this.stats.totalRequests
  }

  // Get performance report
  getReport() {
    const endpointReport = Array.from(this.stats.endpoints.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        ...stats,
        slowPercentage: ((stats.slowCount / stats.count) * 100).toFixed(2)
      }))
      .sort((a, b) => b.averageTime - a.averageTime)

    return {
      summary: {
        totalRequests: this.stats.totalRequests,
        slowQueries: this.stats.slowQueries,
        slowPercentage: ((this.stats.slowQueries / this.stats.totalRequests) * 100).toFixed(2),
        averageResponseTime: this.stats.averageResponseTime.toFixed(2)
      },
      slowestEndpoints: endpointReport.slice(0, 10),
      allEndpoints: endpointReport
    }
  }

  // Reset stats
  reset() {
    this.stats = {
      totalRequests: 0,
      slowQueries: 0,
      averageResponseTime: 0,
      endpoints: new Map()
    }
  }
}

// MongoDB query performance monitoring
function enableMongooseDebug() {
  mongoose.set('debug', (collectionName, method, query, doc) => {
    const startTime = Date.now()
    
    // Override the original method to measure execution time
    const originalMethod = mongoose.Collection.prototype[method]
    if (originalMethod) {
      mongoose.Collection.prototype[method] = function(...args) {
        const result = originalMethod.apply(this, args)
        const endTime = Date.now()
        const executionTime = endTime - startTime
        
        if (executionTime > 500) { // Log queries taking more than 500ms
          console.warn(`🐌 SLOW DB QUERY:`, {
            collection: collectionName,
            method,
            executionTime: `${executionTime}ms`,
            query: JSON.stringify(query).substring(0, 200)
          })
        }
        
        return result
      }
    }
  })
}

// Create global instance
const performanceMonitor = new PerformanceMonitor()

module.exports = {
  performanceMonitor,
  enableMongooseDebug
}