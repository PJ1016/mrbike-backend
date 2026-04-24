/**
 * Performance Report Generator
 * Analyzes API performance and generates reports
 */

const { performanceMonitor } = require('../utils/performanceMonitor')
const { cache } = require('../utils/cache')

function generatePerformanceReport() {
  console.log('📊 BikeDoctor API Performance Report')
  console.log('=====================================')
  
  const report = performanceMonitor.getReport()
  
  // Summary
  console.log('\n📈 Summary:')
  console.log(`Total Requests: ${report.summary.totalRequests}`)
  console.log(`Slow Queries: ${report.summary.slowQueries} (${report.summary.slowPercentage}%)`)
  console.log(`Average Response Time: ${report.summary.averageResponseTime}ms`)
  
  // Cache Stats
  const cacheStats = cache.getStats()
  console.log(`\\n💾 Cache Stats:`)
  console.log(`Cached Items: ${cacheStats.size}`)
  console.log(`Cache Keys: ${cacheStats.keys.join(', ')}`)
  
  // Slowest Endpoints
  if (report.slowestEndpoints.length > 0) {\n    console.log('\\n🐌 Slowest Endpoints:')\n    report.slowestEndpoints.forEach((endpoint, index) => {\n      console.log(`${index + 1}. ${endpoint.endpoint}`)\n      console.log(`   Average: ${endpoint.averageTime.toFixed(2)}ms`)\n      console.log(`   Requests: ${endpoint.count}`)\n      console.log(`   Slow: ${endpoint.slowCount} (${endpoint.slowPercentage}%)`)\n      console.log('')\n    })\n  }\n  \n  // Recommendations\n  console.log('\\n💡 Performance Recommendations:')\n  \n  if (report.summary.slowPercentage > 10) {\n    console.log('⚠️  High percentage of slow queries detected!')\n    console.log('   - Consider adding database indexes')\n    console.log('   - Review query optimization')\n    console.log('   - Implement caching for frequently accessed data')\n  }\n  \n  if (cacheStats.size === 0) {\n    console.log('⚠️  No cached data found!')\n    console.log('   - Implement caching for bike data')\n    console.log('   - Cache service listings')\n    console.log('   - Cache company/model/variant data')\n  }\n  \n  const bikeEndpoints = report.allEndpoints.filter(e => \n    e.endpoint.includes('/bike') || e.endpoint.includes('/service')\n  )\n  \n  if (bikeEndpoints.some(e => e.averageTime > 1000)) {\n    console.log('⚠️  Slow bike/service endpoints detected!')\n    console.log('   - Run: npm run create-indexes')\n    console.log('   - Implement pagination for large datasets')\n    console.log('   - Use lean() queries where possible')\n  }\n  \n  console.log('\\n✅ Optimization Tips:')\n  console.log('1. Run database indexing: npm run create-indexes')\n  console.log('2. Monitor cache hit rates')\n  console.log('3. Use aggregation pipelines for complex queries')\n  console.log('4. Implement pagination for large result sets')\n  console.log('5. Use field selection to reduce data transfer')\n  \n  console.log('\\n=====================================\\n')\n}\n\n// Export for use in other modules\nmodule.exports = {\n  generatePerformanceReport\n}\n\n// Run if called directly\nif (require.main === module) {\n  generatePerformanceReport()\n}