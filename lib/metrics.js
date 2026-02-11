/**
 * Performance monitoring and metrics tracking
 * Tracks timing, cache hits/misses, and other performance metrics
 */

const { debug, info } = require('./logger');

// In-memory metrics storage
const metrics = {
  oauth: {
    totalAttempts: 0,
    successCount: 0,
    failureCount: 0,
    totalDurationMs: 0,
    avgDurationMs: 0
  },
  requests: {
    totalCount: 0,
    successCount: 0,
    errorCount: 0,
    totalDurationMs: 0,
    avgDurationMs: 0
  },
  tokenCache: {
    hits: 0,
    misses: 0,
    hitRate: 0
  }
};

/**
 * Starts a timer and returns a function to stop it
 * @param {string} label - Timer label for logging
 * @returns {Function} Function to stop the timer and return elapsed time
 */
function startTimer(label) {
  const startTime = Date.now();

  return function stopTimer() {
    const elapsed = Date.now() - startTime;
    debug(`Timer [${label}] completed`, { durationMs: elapsed });
    return elapsed;
  };
}

/**
 * Records OAuth flow metrics
 * @param {boolean} success - Whether OAuth succeeded
 * @param {number} durationMs - Duration in milliseconds
 */
function recordOAuthAttempt(success, durationMs) {
  metrics.oauth.totalAttempts++;

  if (success) {
    metrics.oauth.successCount++;
  } else {
    metrics.oauth.failureCount++;
  }

  metrics.oauth.totalDurationMs += durationMs;
  metrics.oauth.avgDurationMs = Math.round(
    metrics.oauth.totalDurationMs / metrics.oauth.totalAttempts
  );

  info('OAuth attempt recorded', {
    success,
    durationMs,
    avgDurationMs: metrics.oauth.avgDurationMs,
    successRate: (metrics.oauth.successCount / metrics.oauth.totalAttempts * 100).toFixed(2) + '%'
  });
}

/**
 * Records MCP request metrics
 * @param {boolean} success - Whether request succeeded
 * @param {number} durationMs - Duration in milliseconds
 * @param {string} method - Request method
 */
function recordRequest(success, durationMs, method) {
  metrics.requests.totalCount++;

  if (success) {
    metrics.requests.successCount++;
  } else {
    metrics.requests.errorCount++;
  }

  metrics.requests.totalDurationMs += durationMs;
  metrics.requests.avgDurationMs = Math.round(
    metrics.requests.totalDurationMs / metrics.requests.totalCount
  );

  debug('Request recorded', {
    method,
    success,
    durationMs,
    avgDurationMs: metrics.requests.avgDurationMs,
    successRate: (metrics.requests.successCount / metrics.requests.totalCount * 100).toFixed(2) + '%'
  });
}

/**
 * Records token cache hit
 */
function recordCacheHit() {
  metrics.tokenCache.hits++;
  updateCacheHitRate();
  debug('Token cache hit', {
    hits: metrics.tokenCache.hits,
    hitRate: metrics.tokenCache.hitRate
  });
}

/**
 * Records token cache miss
 */
function recordCacheMiss() {
  metrics.tokenCache.misses++;
  updateCacheHitRate();
  debug('Token cache miss', {
    misses: metrics.tokenCache.misses,
    hitRate: metrics.tokenCache.hitRate
  });
}

/**
 * Updates token cache hit rate
 */
function updateCacheHitRate() {
  const total = metrics.tokenCache.hits + metrics.tokenCache.misses;
  metrics.tokenCache.hitRate = total > 0
    ? parseFloat((metrics.tokenCache.hits / total * 100).toFixed(2))
    : 0;
}

/**
 * Gets current metrics snapshot
 * @returns {object} Current metrics
 */
function getMetrics() {
  return JSON.parse(JSON.stringify(metrics)); // Deep copy
}

/**
 * Resets all metrics (useful for testing)
 */
function resetMetrics() {
  metrics.oauth.totalAttempts = 0;
  metrics.oauth.successCount = 0;
  metrics.oauth.failureCount = 0;
  metrics.oauth.totalDurationMs = 0;
  metrics.oauth.avgDurationMs = 0;

  metrics.requests.totalCount = 0;
  metrics.requests.successCount = 0;
  metrics.requests.errorCount = 0;
  metrics.requests.totalDurationMs = 0;
  metrics.requests.avgDurationMs = 0;

  metrics.tokenCache.hits = 0;
  metrics.tokenCache.misses = 0;
  metrics.tokenCache.hitRate = 0;
}

/**
 * Prints metrics summary
 */
function printMetrics() {
  info('Performance Metrics Summary', {
    oauth: {
      attempts: metrics.oauth.totalAttempts,
      successRate: metrics.oauth.totalAttempts > 0
        ? (metrics.oauth.successCount / metrics.oauth.totalAttempts * 100).toFixed(2) + '%'
        : 'N/A',
      avgDurationMs: metrics.oauth.avgDurationMs
    },
    requests: {
      total: metrics.requests.totalCount,
      successRate: metrics.requests.totalCount > 0
        ? (metrics.requests.successCount / metrics.requests.totalCount * 100).toFixed(2) + '%'
        : 'N/A',
      avgDurationMs: metrics.requests.avgDurationMs
    },
    tokenCache: {
      hits: metrics.tokenCache.hits,
      misses: metrics.tokenCache.misses,
      hitRate: metrics.tokenCache.hitRate + '%'
    }
  });
}

module.exports = {
  startTimer,
  recordOAuthAttempt,
  recordRequest,
  recordCacheHit,
  recordCacheMiss,
  getMetrics,
  resetMetrics,
  printMetrics
};
