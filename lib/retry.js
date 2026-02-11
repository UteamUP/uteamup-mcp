/**
 * Retry logic with exponential backoff
 * Provides resilient error recovery for transient failures
 */

const { warn, error } = require('./logger');

/**
 * Sleep utility
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determines if an error is retryable
 * @param {Error} err - Error to check
 * @returns {boolean} Whether error is retryable
 */
function isRetryableError(err) {
  if (!err) return false;

  // Network errors are retryable
  const networkErrors = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'];
  if (networkErrors.includes(err.code)) {
    return true;
  }

  // Timeout errors are retryable
  if (err.message && err.message.toLowerCase().includes('timeout')) {
    return true;
  }

  // HTTP 429 (rate limiting) is retryable
  if (err.statusCode === 429 || err.status === 429) {
    return true;
  }

  // HTTP 5xx errors are retryable
  if (err.statusCode >= 500 && err.statusCode < 600) {
    return true;
  }
  if (err.status >= 500 && err.status < 600) {
    return true;
  }

  // Not retryable
  return false;
}

/**
 * Calculates exponential backoff delay
 * @param {number} attempt - Current attempt number (1-indexed)
 * @param {number} baseDelay - Base delay in ms (default: 1000)
 * @param {number} maxDelay - Maximum delay in ms (default: 10000)
 * @returns {number} Delay in milliseconds
 */
function calculateBackoff(attempt, baseDelay = 1000, maxDelay = 10000) {
  const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
  // Add jitter (±20%) to prevent thundering herd
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
}

/**
 * Retries a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {object} options - Retry options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.baseDelay - Base delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {Function} options.shouldRetry - Custom function to determine if error is retryable
 * @param {string} options.operationName - Name of operation for logging
 * @returns {Promise<any>} Result of successful function call
 * @throws {Error} Last error if all retries fail
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = isRetryableError,
    operationName = 'operation'
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (err) {
      lastError = err;

      // If this was the last attempt, throw the error
      if (attempt > maxRetries) {
        error(`${operationName} failed after ${maxRetries} retries`, { error: err.message });
        throw err;
      }

      // Check if error is retryable
      if (!shouldRetry(err)) {
        error(`${operationName} failed with non-retryable error`, { error: err.message });
        throw err;
      }

      // Calculate backoff delay
      const delay = calculateBackoff(attempt, baseDelay, maxDelay);

      warn(`${operationName} failed (attempt ${attempt}/${maxRetries + 1}), retrying in ${delay}ms`, {
        error: err.message,
        attempt,
        maxRetries,
        delayMs: delay
      });

      // Wait before retrying
      await sleep(delay);
    }
  }

  // Should never reach here, but just in case
  throw lastError;
}

/**
 * Retries a function with a simple fixed delay
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} delayMs - Fixed delay between retries in ms
 * @returns {Promise<any>} Result of successful function call
 * @throws {Error} Last error if all retries fail
 */
async function retryWithFixedDelay(fn, maxRetries = 3, delayMs = 1000) {
  return retryWithBackoff(fn, {
    maxRetries,
    baseDelay: delayMs,
    maxDelay: delayMs // Same as base = fixed delay
  });
}

module.exports = {
  sleep,
  isRetryableError,
  calculateBackoff,
  retryWithBackoff,
  retryWithFixedDelay
};
