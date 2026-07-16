/**
 * Configuration validation tests
 */

const { loadConfig, validateConfig } = require('../lib/config');

describe('Configuration Validation', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    test('should load valid configuration', () => {
      process.env.UTEAMUP_API_KEY = '12345678901234567890123456789012'; // 32 chars
      process.env.UTEAMUP_SECRET = '1234567890123456789012345678901234567890123456789012345678901234'; // 64 chars

      const config = loadConfig();

      expect(config.apiKey).toBe('12345678901234567890123456789012');
      expect(config.secret).toBe('1234567890123456789012345678901234567890123456789012345678901234');
      expect(config.baseUrl).toBe('https://api.uteamup.com');
      expect(config.logLevel).toBe('INFO');
      expect(config.logFormat).toBe('text');
      expect(config.requestTimeout).toBe(30000);
      expect(config.maxRetries).toBe(3);
      expect(config.maxRequestBytes).toBe(1048576);
      expect(config.maxResponseBytes).toBe(10485760);
    });

    test('should throw error for missing API key', () => {
      process.env.UTEAMUP_SECRET = '1234567890123456789012345678901234567890123456789012345678901234';
      delete process.env.UTEAMUP_API_KEY;

      expect(() => loadConfig()).toThrow('Configuration validation failed');
    });

    test('should throw error for invalid API key length', () => {
      process.env.UTEAMUP_API_KEY = '12345'; // Too short
      process.env.UTEAMUP_SECRET = '1234567890123456789012345678901234567890123456789012345678901234';

      expect(() => loadConfig()).toThrow('API Key must be exactly 32 characters');
    });

    test('should throw error for missing secret', () => {
      process.env.UTEAMUP_API_KEY = '12345678901234567890123456789012';
      delete process.env.UTEAMUP_SECRET;

      expect(() => loadConfig()).toThrow('Configuration validation failed');
    });

    test('should throw error for invalid secret length', () => {
      process.env.UTEAMUP_API_KEY = '12345678901234567890123456789012';
      process.env.UTEAMUP_SECRET = '12345'; // Too short

      expect(() => loadConfig()).toThrow('Secret must be at least 64 characters');
    });

    test('should accept custom base URL', () => {
      process.env.UTEAMUP_API_KEY = '12345678901234567890123456789012';
      process.env.UTEAMUP_SECRET = '1234567890123456789012345678901234567890123456789012345678901234';
      process.env.UTEAMUP_API_BASE_URL = 'https://dev.example.com';

      const config = loadConfig();
      expect(config.baseUrl).toBe('https://dev.example.com');
    });

    test.each([
      'http://dev.example.com',
      'https://user:password@dev.example.com',
      'https://dev.example.com/untrusted-path',
      'https://dev.example.com/?redirect=https://attacker.example'
    ])('should reject unsafe base URL %s', unsafeUrl => {
      process.env.UTEAMUP_API_KEY = '12345678901234567890123456789012';
      process.env.UTEAMUP_SECRET = '1234567890123456789012345678901234567890123456789012345678901234';
      process.env.UTEAMUP_API_BASE_URL = unsafeUrl;

      expect(() => loadConfig()).toThrow(/base URL/i);
    });

    test('should parse transport byte limits', () => {
      process.env.UTEAMUP_API_KEY = '12345678901234567890123456789012';
      process.env.UTEAMUP_SECRET = '1234567890123456789012345678901234567890123456789012345678901234';
      process.env.UTEAMUP_MAX_REQUEST_BYTES = '2048';
      process.env.UTEAMUP_MAX_RESPONSE_BYTES = '4096';

      const config = loadConfig();

      expect(config.maxRequestBytes).toBe(2048);
      expect(config.maxResponseBytes).toBe(4096);
    });

    test('should validate log level enum', () => {
      process.env.UTEAMUP_API_KEY = '12345678901234567890123456789012';
      process.env.UTEAMUP_SECRET = '1234567890123456789012345678901234567890123456789012345678901234';
      process.env.UTEAMUP_LOG_LEVEL = 'DEBUG';

      const config = loadConfig();
      expect(config.logLevel).toBe('DEBUG');
    });

    test('should reject invalid log level', () => {
      process.env.UTEAMUP_API_KEY = '12345678901234567890123456789012';
      process.env.UTEAMUP_SECRET = '1234567890123456789012345678901234567890123456789012345678901234';
      process.env.UTEAMUP_LOG_LEVEL = 'INVALID';

      expect(() => loadConfig()).toThrow();
    });

    test('should parse integer values correctly', () => {
      process.env.UTEAMUP_API_KEY = '12345678901234567890123456789012';
      process.env.UTEAMUP_SECRET = '1234567890123456789012345678901234567890123456789012345678901234';
      process.env.UTEAMUP_REQUEST_TIMEOUT = '60000';
      process.env.UTEAMUP_MAX_RETRIES = '5';

      const config = loadConfig();
      expect(config.requestTimeout).toBe(60000);
      expect(config.maxRetries).toBe(5);
    });

    test('should upgrade log level when debug mode is enabled', () => {
      process.env.UTEAMUP_API_KEY = '12345678901234567890123456789012';
      process.env.UTEAMUP_SECRET = '1234567890123456789012345678901234567890123456789012345678901234';
      process.env.UTEAMUP_DEBUG = '1';

      const config = loadConfig();
      expect(config.debug).toBe(true);
      expect(config.logLevel).toBe('DEBUG');
    });
  });

  describe('validateConfig', () => {
    test('should return success for valid config', () => {
      process.env.UTEAMUP_API_KEY = '12345678901234567890123456789012';
      process.env.UTEAMUP_SECRET = '1234567890123456789012345678901234567890123456789012345678901234';

      const result = validateConfig();
      expect(result.success).toBe(true);
      expect(result.config).toBeDefined();
    });

    test('should return error for invalid config', () => {
      delete process.env.UTEAMUP_API_KEY;
      delete process.env.UTEAMUP_SECRET;

      const result = validateConfig();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
