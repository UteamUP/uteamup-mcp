/**
 * Retry logic tests
 */

const {
  isRetryableError,
  calculateBackoff,
  retryWithBackoff,
  retryWithFixedDelay
} = require('../lib/retry');

describe('Retry Logic', () => {
  describe('isRetryableError', () => {
    test('should identify network errors as retryable', () => {
      const errors = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'];

      errors.forEach(code => {
        const error = new Error('Network error');
        error.code = code;
        expect(isRetryableError(error)).toBe(true);
      });
    });

    test('should identify timeout errors as retryable', () => {
      const error = new Error('Request timeout');
      expect(isRetryableError(error)).toBe(true);
    });

    test('should identify HTTP 429 as retryable', () => {
      const error = new Error('Rate limited');
      error.statusCode = 429;
      expect(isRetryableError(error)).toBe(true);
    });

    test('should identify HTTP 5xx as retryable', () => {
      const statusCodes = [500, 502, 503, 504];

      statusCodes.forEach(code => {
        const error = new Error('Server error');
        error.statusCode = code;
        expect(isRetryableError(error)).toBe(true);
      });
    });

    test('should identify HTTP 4xx (except 429) as non-retryable', () => {
      const statusCodes = [400, 401, 403, 404];

      statusCodes.forEach(code => {
        const error = new Error('Client error');
        error.statusCode = code;
        expect(isRetryableError(error)).toBe(false);
      });
    });

    test('should return false for non-error values', () => {
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });
  });

  describe('calculateBackoff', () => {
    test('should calculate exponential backoff', () => {
      const delay1 = calculateBackoff(1, 1000, 10000);
      const delay2 = calculateBackoff(2, 1000, 10000);
      const delay3 = calculateBackoff(3, 1000, 10000);

      // Allow for jitter variance (±20%)
      expect(delay1).toBeGreaterThanOrEqual(800);
      expect(delay1).toBeLessThanOrEqual(1200);

      expect(delay2).toBeGreaterThanOrEqual(1600);
      expect(delay2).toBeLessThanOrEqual(2400);

      expect(delay3).toBeGreaterThanOrEqual(3200);
      expect(delay3).toBeLessThanOrEqual(4800);
    });

    test('should respect maximum delay', () => {
      const delay = calculateBackoff(10, 1000, 5000);
      expect(delay).toBeLessThanOrEqual(6000); // 5000 + 20% jitter
    });

    test('should add jitter to prevent thundering herd', () => {
      const delays = [];
      for (let i = 0; i < 10; i++) {
        delays.push(calculateBackoff(1, 1000, 10000));
      }

      // Check that not all delays are identical
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('retryWithBackoff', () => {
    test('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(fn, { maxRetries: 3 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should retry on retryable error', async () => {
      const error = new Error('Network error');
      error.code = 'ECONNREFUSED';

      const fn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelay: 10,
        maxDelay: 10
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    test('should throw after max retries', async () => {
      const error = new Error('Network error');
      error.code = 'ECONNREFUSED';

      const fn = jest.fn().mockRejectedValue(error);

      await expect(retryWithBackoff(fn, {
        maxRetries: 2,
        baseDelay: 10,
        maxDelay: 10
      })).rejects.toThrow('Network error');

      expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    test('should not retry non-retryable errors', async () => {
      const error = new Error('Bad request');
      error.statusCode = 400;

      const fn = jest.fn().mockRejectedValue(error);

      await expect(retryWithBackoff(fn, { maxRetries: 3 })).rejects.toThrow('Bad request');

      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });

    test('should use custom shouldRetry function', async () => {
      const error = new Error('Custom error');

      const fn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const shouldRetry = jest.fn().mockReturnValue(true);

      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelay: 10,
        maxDelay: 10,
        shouldRetry
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(shouldRetry).toHaveBeenCalledWith(error);
    });
  });

  describe('retryWithFixedDelay', () => {
    test('should retry with fixed delay', async () => {
      const error = new Error('Network error');
      error.code = 'ECONNREFUSED';

      const fn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const result = await retryWithFixedDelay(fn, 2, 10);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
