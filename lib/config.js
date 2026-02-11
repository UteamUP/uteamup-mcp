/**
 * Configuration validation using Zod
 * Validates environment variables and provides type-safe configuration
 */

const { z } = require('zod');

// Configuration schema
const configSchema = z.object({
  // Required credentials
  apiKey: z.string()
    .length(32, 'API Key must be exactly 32 characters')
    .describe('MCP-enabled API key from UteamUP'),

  secret: z.string()
    .min(64, 'Secret must be at least 64 characters')
    .describe('API key secret from UteamUP'),

  // Optional configuration
  baseUrl: z.string()
    .url('Base URL must be a valid URL')
    .default('https://api.uteamup.com')
    .describe('API endpoint URL'),

  // Logging configuration
  logLevel: z.enum(['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'])
    .default('INFO')
    .describe('Logging level'),

  logFormat: z.enum(['text', 'json'])
    .default('text')
    .describe('Log output format'),

  // Legacy debug flag (for backward compatibility)
  debug: z.boolean()
    .default(false)
    .describe('Legacy debug mode'),

  // Request configuration
  requestTimeout: z.number()
    .int()
    .min(1000)
    .max(300000) // 5 minutes max
    .default(30000)
    .describe('Request timeout in milliseconds'),

  maxRetries: z.number()
    .int()
    .min(0)
    .max(10)
    .default(3)
    .describe('Maximum retry attempts for network errors'),

  // Token management
  tokenCacheDir: z.string()
    .optional()
    .describe('Optional persistent token cache directory'),

  tokenRefreshMargin: z.number()
    .int()
    .min(0)
    .max(3600) // 1 hour max
    .default(300) // 5 minutes
    .describe('Token refresh margin in seconds')
});

/**
 * Loads and validates configuration from environment variables
 * @returns {object} Validated configuration object
 * @throws {Error} If configuration is invalid
 */
function loadConfig() {
  // Parse environment variables
  const rawConfig = {
    apiKey: process.env.UTEAMUP_API_KEY,
    secret: process.env.UTEAMUP_SECRET,
    baseUrl: process.env.UTEAMUP_API_BASE_URL || 'https://api.uteamup.com',
    logLevel: (process.env.UTEAMUP_LOG_LEVEL || 'INFO').toUpperCase(),
    logFormat: (process.env.UTEAMUP_LOG_FORMAT || 'text').toLowerCase(),
    debug: process.env.UTEAMUP_DEBUG === '1' || process.env.UTEAMUP_DEBUG === 'true',
    requestTimeout: parseInt(process.env.UTEAMUP_REQUEST_TIMEOUT || '30000', 10),
    maxRetries: parseInt(process.env.UTEAMUP_MAX_RETRIES || '3', 10),
    tokenCacheDir: process.env.UTEAMUP_TOKEN_CACHE_DIR,
    tokenRefreshMargin: parseInt(process.env.UTEAMUP_TOKEN_REFRESH_MARGIN || '300', 10)
  };

  // If debug mode is enabled, upgrade log level to DEBUG
  if (rawConfig.debug && rawConfig.logLevel === 'INFO') {
    rawConfig.logLevel = 'DEBUG';
  }

  try {
    // Validate configuration
    const config = configSchema.parse(rawConfig);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format validation errors nicely
      const errors = error.errors.map(err => {
        const path = err.path.join('.');
        return `  - ${path}: ${err.message}`;
      });

      throw new Error(
        'Configuration validation failed:\n' +
        errors.join('\n') +
        '\n\nRequired environment variables:\n' +
        '  UTEAMUP_API_KEY    - Your MCP-enabled API key (32 characters)\n' +
        '  UTEAMUP_SECRET     - Your API key secret (64+ characters)\n\n' +
        'Optional environment variables:\n' +
        '  UTEAMUP_API_BASE_URL        - API endpoint (default: https://api.uteamup.com)\n' +
        '  UTEAMUP_LOG_LEVEL           - Log level (default: INFO)\n' +
        '  UTEAMUP_LOG_FORMAT          - Log format (default: text)\n' +
        '  UTEAMUP_DEBUG               - Enable debug mode (1 or true)\n' +
        '  UTEAMUP_REQUEST_TIMEOUT     - Request timeout in ms (default: 30000)\n' +
        '  UTEAMUP_MAX_RETRIES         - Max retry attempts (default: 3)\n' +
        '  UTEAMUP_TOKEN_CACHE_DIR     - Persistent token cache directory\n' +
        '  UTEAMUP_TOKEN_REFRESH_MARGIN - Token refresh margin in seconds (default: 300)'
      );
    }
    throw error;
  }
}

/**
 * Validates configuration without throwing (returns validation result)
 * @returns {{success: boolean, config?: object, error?: string}} Validation result
 */
function validateConfig() {
  try {
    const config = loadConfig();
    return { success: true, config };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Prints configuration summary (with secrets redacted)
 * @param {object} config - Configuration object
 */
function printConfigSummary(config) {
  console.error('[MCP Proxy] Configuration:');
  console.error(`  Base URL: ${config.baseUrl}`);
  console.error(`  API Key: ${config.apiKey.substring(0, 8)}...`);
  console.error(`  Log Level: ${config.logLevel}`);
  console.error(`  Log Format: ${config.logFormat}`);
  console.error(`  Request Timeout: ${config.requestTimeout}ms`);
  console.error(`  Max Retries: ${config.maxRetries}`);
  console.error(`  Token Refresh Margin: ${config.tokenRefreshMargin}s`);
  if (config.tokenCacheDir) {
    console.error(`  Token Cache Dir: ${config.tokenCacheDir}`);
  }
}

module.exports = {
  loadConfig,
  validateConfig,
  printConfigSummary,
  configSchema
};
