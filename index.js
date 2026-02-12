#!/usr/bin/env node

/**
 * UteamUP MCP Proxy - Production-ready OAuth handler with enhanced debugging
 * Version: 1.0.0-beta.9
 *
 * Features:
 * - OAuth 2.0 Authorization Code + PKCE authentication
 * - Structured logging with Pino (JSON/text formats)
 * - Configuration validation with Zod
 * - Performance monitoring and metrics
 * - Retry logic with exponential backoff
 * - Request/response tracing with sensitive data redaction
 * - CLI utilities (--help, --version, --validate-config, --test-auth)
 */

const https = require('https');
const crypto = require('crypto');
const { loadConfig, validateConfig, printConfigSummary } = require('./lib/config');
const { trace, debug, info, warn, error } = require('./lib/logger');
const { startTimer, recordOAuthAttempt, recordRequest, recordCacheHit, recordCacheMiss, printMetrics } = require('./lib/metrics');
const { retryWithBackoff } = require('./lib/retry');

// Package version
const VERSION = '1.0.0-beta.9';

// CLI argument handling
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
UteamUP MCP Proxy v${VERSION}
OAuth 2.0 + PKCE proxy for Model Context Protocol integration

USAGE:
  npx @uteamup/mcp-server [OPTIONS]

OPTIONS:
  --help, -h              Show this help message
  --version, -v           Print version and exit
  --validate-config       Validate configuration and exit
  --test-auth             Test OAuth authentication and exit

ENVIRONMENT VARIABLES:
  Required:
    UTEAMUP_API_KEY          Your MCP-enabled API key (32 characters)
    UTEAMUP_SECRET           Your API key secret (64+ characters)

  Optional:
    UTEAMUP_API_BASE_URL     API endpoint (default: https://api.uteamup.com)
    UTEAMUP_LOG_LEVEL        Log level: TRACE, DEBUG, INFO, WARN, ERROR (default: INFO)
    UTEAMUP_LOG_FORMAT       Log format: text, json (default: text)
    UTEAMUP_DEBUG            Enable debug mode (1 or true) - legacy, use LOG_LEVEL instead
    UTEAMUP_REQUEST_TIMEOUT  Request timeout in ms (default: 30000)
    UTEAMUP_MAX_RETRIES      Max retry attempts (default: 3)
    UTEAMUP_TOKEN_CACHE_DIR  Persistent token cache directory (optional)
    UTEAMUP_TOKEN_REFRESH_MARGIN  Token refresh margin in seconds (default: 300)

EXAMPLES:
  # Basic usage
  export UTEAMUP_API_KEY="your-api-key"
  export UTEAMUP_SECRET="your-secret"
  npx @uteamup/mcp-server

  # With debug logging
  export UTEAMUP_LOG_LEVEL="DEBUG"
  npx @uteamup/mcp-server

  # Validate configuration
  npx @uteamup/mcp-server --validate-config

  # Test authentication
  npx @uteamup/mcp-server --test-auth

DOCUMENTATION:
  https://github.com/uteamup/mcp-server
`);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log(`v${VERSION}`);
  process.exit(0);
}

// Load and validate configuration
let config;
try {
  config = loadConfig();
} catch (err) {
  console.error('Configuration Error:');
  console.error(err.message);
  process.exit(1);
}

// Handle --validate-config
if (args.includes('--validate-config')) {
  console.error('✅ Configuration is valid!');
  printConfigSummary(config);
  process.exit(0);
}

// Token cache
let accessToken = null;
let tokenExpiry = null;
let requestIdCounter = 0;

/**
 * Generates a unique request ID
 * @returns {string} Unique request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${++requestIdCounter}`;
}

/**
 * Generates a PKCE (Proof Key for Code Exchange) code verifier and challenge pair.
 * @returns {{verifier: string, challenge: string}} PKCE pair with S256 challenge
 */
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  debug('Generated PKCE pair', {
    verifierLength: verifier.length,
    challengeLength: challenge.length
  });
  return { verifier, challenge };
}

/**
 * Gets an OAuth access token, using cached token if still valid.
 * Implements full OAuth 2.0 Authorization Code + PKCE flow with retry logic.
 * @returns {Promise<string>} JWT access token valid for 7 days
 * @throws {Error} If authentication fails or credentials are invalid
 */
async function getAccessToken() {
  // Return cached token if still valid (with refresh margin)
  const refreshMargin = config.tokenRefreshMargin * 1000; // Convert to ms
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry - refreshMargin) {
    recordCacheHit();
    trace('Using cached access token', {
      expiresAt: new Date(tokenExpiry).toISOString(),
      remainingMs: tokenExpiry - Date.now()
    });
    return accessToken;
  }

  recordCacheMiss();
  info('Getting new access token');

  const stopTimer = startTimer('oauth_flow');

  try {
    const { verifier, challenge } = generatePKCE();

    // Step 1: Get authorization code with retry
    const authCode = await retryWithBackoff(
      async () => {
        return new Promise((resolve, reject) => {
          const authParams = new URLSearchParams({
            response_type: 'code',
            client_id: config.apiKey,
            redirect_uri: 'http://localhost:3000/callback',
            code_challenge: challenge,
            code_challenge_method: 'S256',
            scope: 'mcp:full'
          });

          trace('Requesting authorization code', {
            clientId: config.apiKey.substring(0, 8) + '...',
            scope: 'mcp:full'
          });

          https.get(`${config.baseUrl}/oauth/authorize?${authParams}`, {
            rejectUnauthorized: false, // Allow self-signed certs for dev
            timeout: config.requestTimeout
          }, (res) => {
            const location = res.headers.location || '';
            debug('Authorization redirect received', { location });

            // Check for OAuth error in redirect
            if (location.includes('error=')) {
              const url = new URL(location, 'http://localhost');
              const errorType = url.searchParams.get('error');
              const description = url.searchParams.get('error_description');
              reject(new Error(`OAuth authorization failed: ${errorType} - ${description || 'Unknown error'}`));
              return;
            }

            const match = location.match(/code=([^&]+)/);
            if (match) {
              debug('Authorization code received');
              resolve(match[1]);
            } else {
              reject(new Error('No authorization code in redirect. Location: ' + location));
            }
          }).on('error', reject);
        });
      },
      {
        maxRetries: config.maxRetries,
        operationName: 'OAuth authorization'
      }
    );

    info('Authorization code received', {
      codePrefix: authCode.substring(0, 20) + '...'
    });

    // Step 2: Exchange for access token with retry
    const tokenData = new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: 'http://localhost:3000/callback',
      client_id: config.apiKey,
      client_secret: config.secret,
      code_verifier: verifier
    }).toString();

    const token = await retryWithBackoff(
      async () => {
        return new Promise((resolve, reject) => {
          trace('Exchanging authorization code for access token');

          const req = https.request(`${config.baseUrl}/oauth/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(tokenData)
            },
            rejectUnauthorized: false,
            timeout: config.requestTimeout
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              debug('Token exchange response received', {
                statusCode: res.statusCode,
                dataLength: data.length
              });

              // Check for error status codes
              if (res.statusCode === 401) {
                reject(new Error('Authentication failed: Invalid API Key or Secret. Please verify your credentials in UteamUP Tenant Settings → API Keys.'));
                return;
              }
              if (res.statusCode === 403) {
                if (data.includes('MCP') || data.includes('mcp')) {
                  reject(new Error('MCP access denied: Your API key does not have MCP enabled. Create a new MCP-enabled key in Tenant Settings → API Keys.'));
                } else {
                  reject(new Error('Access forbidden: ' + data));
                }
                return;
              }
              if (res.statusCode !== 200) {
                reject(new Error(`Token exchange failed (HTTP ${res.statusCode}): ${data}`));
                return;
              }

              try {
                const json = JSON.parse(data);
                // Accept both camelCase (accessToken) and snake_case (access_token) formats
                const token = json.accessToken || json.access_token;
                if (token) {
                  debug('Access token received successfully');
                  resolve(token);
                } else if (json.error) {
                  reject(new Error(`OAuth error: ${json.error} - ${json.error_description || ''}`));
                } else {
                  reject(new Error(`Token exchange failed: ${data}`));
                }
              } catch (e) {
                reject(new Error(`Invalid JSON response: ${data}`));
              }
            });
          });

          req.on('error', reject);
          req.write(tokenData);
          req.end();
        });
      },
      {
        maxRetries: config.maxRetries,
        operationName: 'Token exchange'
      }
    );

    accessToken = token;
    tokenExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

    const duration = stopTimer();
    recordOAuthAttempt(true, duration);

    info('Access token obtained successfully', {
      expiresAt: new Date(tokenExpiry).toISOString(),
      durationMs: duration
    });

    return accessToken;
  } catch (err) {
    const duration = stopTimer();
    recordOAuthAttempt(false, duration);
    error('OAuth flow failed', err);
    throw err;
  }
}

/**
 * Parses Server-Sent Events (SSE) format response to extract JSON data.
 * SSE format looks like:
 *   event: message
 *   data: {"json":"here"}
 *
 * @param {string} sseData - Raw SSE response string
 * @returns {object|null} Parsed JSON object from data field, or null if not SSE format
 */
function parseSSE(sseData) {
  const lines = sseData.trim().split('\n');
  let jsonData = null;

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      jsonData = line.substring(6); // Remove "data: " prefix
      break;
    }
  }

  if (jsonData) {
    try {
      return JSON.parse(jsonData);
    } catch (e) {
      debug('SSE data parse error', { error: e.message });
      return null;
    }
  }

  return null;
}

/**
 * Forwards a JSON-RPC 2.0 MCP request to the backend.
 * Handles both plain JSON and Server-Sent Events (SSE) response formats.
 * @param {object} request - JSON-RPC 2.0 request object
 * @param {string} requestId - Unique request ID for tracing
 * @returns {Promise<object>} JSON-RPC 2.0 response object
 */
async function forwardRequest(request, requestId) {
  const stopTimer = startTimer(`request_${request.method}`);

  try {
    const token = await getAccessToken();
    const data = JSON.stringify(request);

    trace('Forwarding MCP request', {
      requestId,
      method: request.method,
      id: request.id,
      bodyLength: data.length
    });

    const response = await retryWithBackoff(
      async () => {
        return new Promise((resolve, reject) => {
          const req = https.request(`${config.baseUrl}/mcp`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json, text/event-stream',
              'Content-Length': Buffer.byteLength(data),
              'X-Request-ID': requestId
            },
            rejectUnauthorized: false,
            timeout: config.requestTimeout
          }, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
              trace('MCP response received', {
                requestId,
                statusCode: res.statusCode,
                dataLength: responseData.length
              });

              // Handle empty responses (e.g., HTTP 202 for notifications)
              if (responseData.length === 0) {
                debug('Empty response received (likely notification acknowledged)', { requestId });
                // For notifications (no id), don't send a response
                if (request.id === undefined || request.id === null) {
                  trace('Notification acknowledged, no response needed', { requestId });
                  resolve(null); // Don't send anything back for notifications
                } else {
                  // For requests with ID, return success
                  resolve({ jsonrpc: '2.0', result: {}, id: request.id });
                }
                return;
              }

              // Try parsing as SSE format first (text/event-stream)
              if (responseData.includes('event:') || responseData.includes('data:')) {
                debug('Detected SSE format, parsing...', { requestId });
                const parsed = parseSSE(responseData);
                if (parsed) {
                  trace('SSE parsed successfully', { requestId, result: parsed });
                  resolve(parsed);
                  return;
                }
              }

              // Fall back to plain JSON parsing
              try {
                const parsed = JSON.parse(responseData);
                trace('JSON parsed successfully', { requestId, result: parsed });
                resolve(parsed);
              } catch (e) {
                debug('Parse error (not SSE, not JSON)', { requestId, error: e.message });
                resolve({
                  jsonrpc: '2.0',
                  error: { code: -32700, message: 'Parse error', data: responseData },
                  id: request.id
                });
              }
            });
          });

          req.on('error', reject);
          req.write(data);
          req.end();
        });
      },
      {
        maxRetries: config.maxRetries,
        operationName: `MCP request [${request.method}]`
      }
    );

    const duration = stopTimer();
    recordRequest(true, duration, request.method);

    return response;
  } catch (err) {
    const duration = stopTimer();
    recordRequest(false, duration, request.method);
    error('Request forwarding failed', {
      requestId,
      method: request.method,
      error: err.message
    });
    throw err;
  }
}

// Handle --test-auth
if (args.includes('--test-auth')) {
  (async () => {
    console.error('Testing OAuth authentication...');
    printConfigSummary(config);
    console.error('');

    try {
      const stopTimer = startTimer('test_auth');
      const token = await getAccessToken();
      const duration = stopTimer();

      console.error('');
      console.error('✅ Authentication successful!');
      console.error(`   Token obtained in ${duration}ms`);
      console.error(`   Token prefix: ${token.substring(0, 20)}...`);
      console.error(`   Token expires: ${new Date(tokenExpiry).toISOString()}`);
      printMetrics();
      process.exit(0);
    } catch (err) {
      console.error('');
      console.error('❌ Authentication failed!');
      console.error(`   Error: ${err.message}`);
      process.exit(1);
    }
  })();
  return; // Don't start main loop
}

// Main stdio loop
async function main() {
  info('Starting UteamUP MCP Server', {
    version: VERSION,
    baseUrl: config.baseUrl,
    logLevel: config.logLevel,
    logFormat: config.logFormat
  });

  printConfigSummary(config);

  let buffer = '';

  process.stdin.on('data', async (chunk) => {
    buffer += chunk.toString();

    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (!line) continue;

      const requestId = generateRequestId();

      try {
        const request = JSON.parse(line);

        info('Processing request', {
          requestId,
          method: request.method,
          id: request.id
        });

        const response = await forwardRequest(request, requestId);

        // For notifications (null response), don't write anything to stdout
        if (response === null) {
          debug('Notification handled, no response sent', { requestId });
          continue;
        }

        // Ensure response includes request ID for proper JSON-RPC 2.0 format
        if (request.id !== undefined && response.id === undefined) {
          response.id = request.id;
        }

        process.stdout.write(JSON.stringify(response) + '\n');
        trace('Response sent', { requestId, responseId: request.id });
      } catch (err) {
        error('Request processing error', {
          requestId,
          error: err.message
        });

        // Try to extract request ID if possible
        let requestIdFromLine = null;
        try {
          const req = JSON.parse(line);
          requestIdFromLine = req.id;
        } catch (e) {
          // Line wasn't valid JSON, use null
        }

        const errorResponse = {
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: err.message,
            data: config.logLevel === 'DEBUG' || config.logLevel === 'TRACE' ? err.stack : undefined
          },
          id: requestIdFromLine
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    }
  });

  process.stdin.on('end', () => {
    info('stdin closed, exiting');
    printMetrics();
    process.exit(0);
  });

  process.stdin.resume();
}

// Graceful shutdown handlers
process.on('SIGINT', () => {
  info('Received SIGINT, shutting down gracefully...');
  printMetrics();
  process.exit(0);
});

process.on('SIGTERM', () => {
  info('Received SIGTERM, shutting down gracefully...');
  printMetrics();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  error('Uncaught exception', err);
  process.exit(1);
});

main().catch((err) => {
  error('Fatal error', err);
  process.exit(1);
});
