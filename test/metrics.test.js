/**
 * Metrics tracking tests
 */

const {
  startTimer,
  recordOAuthAttempt,
  recordRequest,
  recordCacheHit,
  recordCacheMiss,
  getMetrics,
  resetMetrics
} = require('../lib/metrics');

describe('Metrics Tracking', () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe('startTimer', () => {
    test('should measure elapsed time', () => {
      jest.useFakeTimers();
      const stopTimer = startTimer('test');
      jest.advanceTimersByTime(100);
      const elapsed = stopTimer();
      jest.useRealTimers();

      expect(elapsed).toBe(100);
    });

    test('should return different times for different timers', async () => {
      const stopTimer1 = startTimer('timer1');
      await new Promise(resolve => setTimeout(resolve, 50));
      const elapsed1 = stopTimer1();

      const stopTimer2 = startTimer('timer2');
      await new Promise(resolve => setTimeout(resolve, 100));
      const elapsed2 = stopTimer2();

      expect(elapsed2).toBeGreaterThan(elapsed1);
    });
  });

  describe('recordOAuthAttempt', () => {
    test('should record successful OAuth attempt', () => {
      recordOAuthAttempt(true, 1000);

      const metrics = getMetrics();
      expect(metrics.oauth.totalAttempts).toBe(1);
      expect(metrics.oauth.successCount).toBe(1);
      expect(metrics.oauth.failureCount).toBe(0);
      expect(metrics.oauth.avgDurationMs).toBe(1000);
    });

    test('should record failed OAuth attempt', () => {
      recordOAuthAttempt(false, 500);

      const metrics = getMetrics();
      expect(metrics.oauth.totalAttempts).toBe(1);
      expect(metrics.oauth.successCount).toBe(0);
      expect(metrics.oauth.failureCount).toBe(1);
      expect(metrics.oauth.avgDurationMs).toBe(500);
    });

    test('should calculate average duration correctly', () => {
      recordOAuthAttempt(true, 1000);
      recordOAuthAttempt(true, 2000);
      recordOAuthAttempt(true, 3000);

      const metrics = getMetrics();
      expect(metrics.oauth.avgDurationMs).toBe(2000);
    });
  });

  describe('recordRequest', () => {
    test('should record successful request', () => {
      recordRequest(true, 500, 'tools/list');

      const metrics = getMetrics();
      expect(metrics.requests.totalCount).toBe(1);
      expect(metrics.requests.successCount).toBe(1);
      expect(metrics.requests.errorCount).toBe(0);
      expect(metrics.requests.avgDurationMs).toBe(500);
    });

    test('should record failed request', () => {
      recordRequest(false, 300, 'tools/call');

      const metrics = getMetrics();
      expect(metrics.requests.totalCount).toBe(1);
      expect(metrics.requests.successCount).toBe(0);
      expect(metrics.requests.errorCount).toBe(1);
      expect(metrics.requests.avgDurationMs).toBe(300);
    });

    test('should track multiple requests', () => {
      recordRequest(true, 100, 'initialize');
      recordRequest(true, 200, 'tools/list');
      recordRequest(false, 150, 'tools/call');

      const metrics = getMetrics();
      expect(metrics.requests.totalCount).toBe(3);
      expect(metrics.requests.successCount).toBe(2);
      expect(metrics.requests.errorCount).toBe(1);
      expect(metrics.requests.avgDurationMs).toBe(150);
    });
  });

  describe('Token Cache Metrics', () => {
    test('should record cache hit', () => {
      recordCacheHit();

      const metrics = getMetrics();
      expect(metrics.tokenCache.hits).toBe(1);
      expect(metrics.tokenCache.misses).toBe(0);
      expect(metrics.tokenCache.hitRate).toBe(100);
    });

    test('should record cache miss', () => {
      recordCacheMiss();

      const metrics = getMetrics();
      expect(metrics.tokenCache.hits).toBe(0);
      expect(metrics.tokenCache.misses).toBe(1);
      expect(metrics.tokenCache.hitRate).toBe(0);
    });

    test('should calculate hit rate correctly', () => {
      recordCacheHit();
      recordCacheHit();
      recordCacheHit();
      recordCacheMiss();

      const metrics = getMetrics();
      expect(metrics.tokenCache.hits).toBe(3);
      expect(metrics.tokenCache.misses).toBe(1);
      expect(metrics.tokenCache.hitRate).toBe(75);
    });

    test('should handle zero cache attempts', () => {
      const metrics = getMetrics();
      expect(metrics.tokenCache.hitRate).toBe(0);
    });
  });

  describe('resetMetrics', () => {
    test('should reset all metrics to zero', () => {
      recordOAuthAttempt(true, 1000);
      recordRequest(true, 500, 'test');
      recordCacheHit();

      resetMetrics();

      const metrics = getMetrics();
      expect(metrics.oauth.totalAttempts).toBe(0);
      expect(metrics.requests.totalCount).toBe(0);
      expect(metrics.tokenCache.hits).toBe(0);
    });
  });

  describe('getMetrics', () => {
    test('should return a deep copy of metrics', () => {
      recordOAuthAttempt(true, 1000);

      const metrics1 = getMetrics();
      const metrics2 = getMetrics();

      expect(metrics1).toEqual(metrics2);
      expect(metrics1).not.toBe(metrics2); // Different objects
    });
  });
});
