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

// Additional capability and OAuth fields must be covered by both Pino and recursive redaction.
const capabilityAndOAuthKeys = [
  'uploadUrl', 'upload_url', 'downloadUrl', 'download_url',
  'client_assertion', 'assertion', 'code', 'state', 'email'
];
const exactSensitiveKeys = new Set(capabilityAndOAuthKeys.map(key => key.toLowerCase()));

// Pino configuration
const pinoOptions = {
  level: (LOG_LEVELS[effectiveLevel] !== undefined ? effectiveLevel : 'INFO').toLowerCase(),
  // Use stderr for all logs (stdout reserved for JSON-RPC protocol)
  browser: { write: (msg) => process.stderr.write(msg) },

  // Sanitize every entry point, including raw Pino calls and child logger bindings.
  hooks: {
    logMethod(args, method) {
      const sanitized = args.map(arg => arg instanceof Error
        ? { err: redactSensitive(arg) }
        : redactSensitive(arg));
      return method.apply(this, sanitized);
    }
  },
  formatters: { bindings: bindings => redactSensitive(bindings) },
  // Errors have already been converted to safe records; preserve their original type.
  serializers: {
    err: value => redactSensitive(value),
    // Interpolation can assemble a sensitive URL from individually harmless arguments.
    msg: value => redactSensitive(value)
  },

  // Redact sensitive fields
  redact: {
    paths: [
      ...capabilityAndOAuthKeys.flatMap(key => [key, `*.${key}`]),
      'Authorization',
      'client_secret',
      'code_verifier',
      'access_token',
      'accessToken',
      'apiKey',
      'api_key',
      'cookie',
      'setCookie',
      'set-cookie',
      'refreshToken',
      'refresh_token',
      'idToken',
      'id_token',
      'oauthRedirect',
      'bearer',
      '*.Authorization',
      '*.client_secret',
      '*.code_verifier',
      '*.access_token',
      '*.accessToken',
      '*.apiKey',
      '*.api_key',
      '*.cookie',
      '*.setCookie',
      '*.set-cookie',
      '*.refreshToken',
      '*.refresh_token',
      '*.idToken',
      '*.id_token',
      '*.oauthRedirect',
      'numericCode',
      'numeric_code',
      '*.numericCode',
      '*.numeric_code',
      'photo',
      'bytes',
      'blob',
      'gps',
      'latitude',
      'longitude',
      '*.photo',
      '*.bytes',
      '*.blob',
      '*.gps',
      '*.latitude',
      '*.longitude'
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
// Pino resets binding formatters on children. Sanitize before binding serialization;
// descendants inherit this method as well.
const createPinoChild = logger.child;
logger.child = function (bindings, options) {
  return createPinoChild.call(this, redactSensitive(bindings), options);
};

/**
 * Redacts sensitive information from objects for logging
 * @param {any} data - Data to redact
 * @returns {any} Redacted data
 */
function redactSensitive(data, ancestors = new WeakSet()) {
  if (typeof data === 'string') {
    return data
      .replace(/(\/api\/mcp\/(?:upload-tickets|download-links)\/)[^\s"'<>\\)]+/gi, '$1[REDACTED]')
      .replace(/\b(client_assertion|assertion|code|state|email)(["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s&,"';<>]+)/gi,
        '$1$2[REDACTED]');
  }
  if (!data || typeof data !== 'object') return data;
  if (ancestors.has(data)) return '[Circular]';
  ancestors.add(data);

  const sensitiveKeys = [
    'authorization',
    'client_secret',
    'code_verifier',
    'access_token',
    'accesstoken',
    'apikey',
    'api_key',
    'cookie',
    'refreshtoken',
    'refresh_token',
    'idtoken',
    'id_token',
    'oauthredirect',
    'bearer',
    'password',
    'secret',
    'numericcode',
    'numeric_code',
    'photo',
    'bytes',
    'blob',
    'gps',
    'latitude',
    'longitude'
  ];

  // Error diagnostics are non-enumerable and would otherwise bypass object traversal.
  const redacted = data instanceof Error
    ? { ...data, type: data.name, message: data.message, stack: data.stack,
        ...(data.cause !== undefined ? { cause: data.cause } : {}),
        ...(data.errors !== undefined ? { errors: data.errors } : {}) }
    : Array.isArray(data) ? [...data] : { ...data };

  for (const key in redacted) {
    const lowerKey = key.toLowerCase();

    if (exactSensitiveKeys.has(lowerKey) || sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = redactSensitive(redacted[key], ancestors);
    }
  }

  ancestors.delete(data);
  return redacted;
}

/**
 * Creates a child logger with additional context
 * @param {object} context - Context to add to all logs
 * @returns {object} Child logger
 */
function createChildLogger(context) {
  return logger.child(redactSensitive(context));
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
