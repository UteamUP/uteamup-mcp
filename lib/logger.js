/**
 * Structured logging module using Pino
 * Provides production-ready logging with levels, formatting, and redaction
 */

const pino = require('pino');

// Log levels mapping
const LOG_LEVELS = {
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  WARN: 40,
  ERROR: 50
};

// Get log level from environment (default: INFO)
const logLevel = process.env.UTEAMUP_LOG_LEVEL?.toUpperCase() || 'INFO';
const logFormat = process.env.UTEAMUP_LOG_FORMAT?.toLowerCase() || 'text';

// Legacy UTEAMUP_DEBUG support (maps to DEBUG level)
const effectiveLevel = process.env.UTEAMUP_DEBUG === '1' || process.env.UTEAMUP_DEBUG === 'true'
  ? 'DEBUG'
  : logLevel;

// Pino configuration
const pinoOptions = {
  level: (LOG_LEVELS[effectiveLevel] !== undefined ? effectiveLevel : 'INFO').toLowerCase(),
  // Use stderr for all logs (stdout reserved for JSON-RPC protocol)
  browser: { write: (msg) => process.stderr.write(msg) },

  // Redact sensitive fields
  redact: {
    paths: [
      'Authorization',
      'client_secret',
      'code_verifier',
      'access_token',
      'accessToken',
      'bearer',
      '*.Authorization',
      '*.client_secret',
      '*.code_verifier',
      '*.access_token',
      '*.accessToken',
      'numericCode',
      'numeric_code',
      '*.numericCode',
      '*.numeric_code'
    ],
    remove: true
  },

  // Production: JSON format, Development: pretty-printed
  transport: logFormat === 'json' || process.env.NODE_ENV === 'production'
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          messageFormat: '[MCP Proxy] {msg}',
          destination: 2  // Write to stderr (critical for MCP stdio protocol)
        }
      }
};

// Create logger instance
const logger = pino(pinoOptions, pino.destination({ dest: 2 })); // 2 = stderr

/**
 * Redacts sensitive information from objects for logging
 * @param {any} data - Data to redact
 * @returns {any} Redacted data
 */
function redactSensitive(data) {
  if (!data) return data;
  if (typeof data !== 'object') return data;

  const sensitiveKeys = [
    'authorization',
    'client_secret',
    'code_verifier',
    'access_token',
    'accesstoken',
    'bearer',
    'password',
    'secret',
    'numericcode',
    'numeric_code'
  ];

  const redacted = Array.isArray(data) ? [...data] : { ...data };

  for (const key in redacted) {
    const lowerKey = key.toLowerCase();

    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactSensitive(redacted[key]);
    }
  }

  return redacted;
}

/**
 * Creates a child logger with additional context
 * @param {object} context - Context to add to all logs
 * @returns {object} Child logger
 */
function createChildLogger(context) {
  return logger.child(context);
}

/**
 * Trace-level logging (most verbose)
 * @param {string} message - Log message
 * @param {object} context - Additional context
 */
function trace(message, context = {}) {
  logger.trace(redactSensitive(context), message);
}

/**
 * Debug-level logging
 * @param {string} message - Log message
 * @param {object} context - Additional context
 */
function debug(message, context = {}) {
  logger.debug(redactSensitive(context), message);
}

/**
 * Info-level logging
 * @param {string} message - Log message
 * @param {object} context - Additional context
 */
function info(message, context = {}) {
  logger.info(redactSensitive(context), message);
}

/**
 * Warning-level logging
 * @param {string} message - Log message
 * @param {object} context - Additional context
 */
function warn(message, context = {}) {
  logger.warn(redactSensitive(context), message);
}

/**
 * Error-level logging
 * @param {string} message - Log message
 * @param {object|Error} contextOrError - Additional context or Error object
 */
function error(message, contextOrError = {}) {
  if (contextOrError instanceof Error) {
    logger.error({ err: contextOrError }, message);
  } else {
    logger.error(redactSensitive(contextOrError), message);
  }
}

module.exports = {
  logger,
  createChildLogger,
  redactSensitive,
  trace,
  debug,
  info,
  warn,
  error,
  LOG_LEVELS
};
