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
const { loadConfig, printConfigSummary } = require('./lib/config');
const { trace, debug, info, error } = require('./lib/logger');
const { startTimer, recordOAuthAttempt, recordRequest, recordCacheHit, recordCacheMiss, printMetrics } = require('./lib/metrics');
const { retryWithBackoff } = require('./lib/retry');
const { buildMcpForwardHeaders } = require('./lib/mcp-http-headers');
const {
  BoundedLineBuffer,
  ProxyTransportError,
  attachRequestTimeout,
  collectResponseBody,
  getMcpRetryLimit,
  parseOAuthTokenResponse,
  toPublicErrorMessage
} = require('./lib/transport-security');

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
    UTEAMUP_MCP_PATH         /mcp or /mcp/read-only (default: /mcp)
    UTEAMUP_LOG_LEVEL        Log level: TRACE, DEBUG, INFO, WARN, ERROR (default: INFO)
    UTEAMUP_LOG_FORMAT       Log format: text, json (default: text)
    UTEAMUP_DEBUG            Enable debug mode (1 or true) - legacy, use LOG_LEVEL instead
    UTEAMUP_REQUEST_TIMEOUT  Request timeout in ms (default: 30000)
    UTEAMUP_MAX_RETRIES      Max retry attempts (default: 3)
    UTEAMUP_MAX_REQUEST_BYTES   Max JSON-RPC request bytes (default: 1048576)
    UTEAMUP_MAX_RESPONSE_BYTES  Max backend response bytes (default: 10485760)
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
let pendingTokenRequest = null;
let requestIdCounter = 0;
const OAUTH_REDIRECT_URI = 'http://localhost:3000/callback';
const STDIN_CLOSE_GRACE_MS = 2000;
const MAX_FORWARDED_ERROR_LENGTH = 500;

/**
 * Generates a unique request ID
 * @returns {string} Unique request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${++requestIdCounter}`;
}

/**
 * Creates a client-safe HTTP error while preserving status for retry policy.
 * @param {string} message
 * @param {number|undefined} statusCode
 * @returns {ProxyTransportError}
 */
function createHttpError(message, statusCode) {
  const transportError = new ProxyTransportError(message);
  if (Number.isInteger(statusCode)) {
    transportError.statusCode = statusCode;
  }
  return transportError;
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
 * @returns {Promise<string>} JWT access token valid for the backend-reported lifetime
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

  // Requests run concurrently, so share one OAuth flow instead of starting one per request.
  if (!pendingTokenRequest) {
    pendingTokenRequest = requestNewAccessToken().finally(() => {
      pendingTokenRequest = null;
    });
  }
  return pendingTokenRequest;
}

/**
 * Drops the cached token after the backend rejected it, unless a newer token
 * has already replaced it.
 * @param {string} rejectedToken
 */
function clearAccessToken(rejectedToken) {
  if (accessToken === rejectedToken) {
    accessToken = null;
    tokenExpiry = null;
  }
}

async function requestNewAccessToken() {
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
            redirect_uri: OAUTH_REDIRECT_URI,
            code_challenge: challenge,
            code_challenge_method: 'S256',
            scope: 'mcp:full'
          });

          trace('Requesting authorization code', { scope: 'mcp:full' });

          const authorizeUrl = new URL('/oauth/authorize', config.baseUrl);
          authorizeUrl.search = authParams.toString();
          const authRequest = https.get(authorizeUrl, {
            // UTEAMUP-SEC-2026-05-02-008: TLS verification is on by default;
            // UTEAMUP_INSECURE_TLS=1 opts in for self-signed dev certs.
            // Production host (api.uteamup.com) ignores the flag.
            rejectUnauthorized: !config.insecureTLS,
            timeout: config.requestTimeout
          }, (res) => {
            const location = res.headers.location || '';
            res.resume();
            debug('Authorization redirect received', {
              statusCode: res.statusCode,
              hasLocation: Boolean(location)
            });

            let redirectUrl;
            try {
              redirectUrl = new URL(location, OAUTH_REDIRECT_URI);
            } catch {
              reject(new ProxyTransportError('OAuth authorization returned an invalid redirect'));
              return;
            }

            const expectedRedirect = new URL(OAUTH_REDIRECT_URI);
            if (
              redirectUrl.origin !== expectedRedirect.origin ||
              redirectUrl.pathname !== expectedRedirect.pathname
            ) {
              reject(new ProxyTransportError('OAuth authorization returned an unexpected redirect'));
              return;
            }

            // Check for OAuth error in redirect
            if (redirectUrl.searchParams.has('error')) {
              reject(new ProxyTransportError('OAuth authorization was denied'));
              return;
            }

            const authorizationCode = redirectUrl.searchParams.get('code');
            if (authorizationCode) {
              debug('Authorization code received');
              resolve(authorizationCode);
            } else {
              reject(new ProxyTransportError('OAuth authorization did not return a code'));
            }
          });
          authRequest.once('error', reject);
          attachRequestTimeout(authRequest, 'OAuth authorization request');
        });
      },
      {
        maxRetries: config.maxRetries,
        operationName: 'OAuth authorization'
      }
    );

    info('Authorization code received');

    // Step 2: Exchange for access token with retry. Naming the MCP endpoint as the resource
    // (RFC 8707) gets a token the backend accepts only there, never on its REST API.
    const tokenData = new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: OAUTH_REDIRECT_URI,
      client_id: config.apiKey,
      client_secret: config.secret,
      code_verifier: verifier,
      resource: new URL(config.mcpPath, config.baseUrl).href
    }).toString();

    const tokenResponse = await retryWithBackoff(
      async () => {
        return new Promise((resolve, reject) => {
          trace('Exchanging authorization code for access token');

          const req = https.request(new URL('/oauth/token', config.baseUrl), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(tokenData)
            },
            // UTEAMUP-SEC-2026-05-02-008: see authorize handler above.
            rejectUnauthorized: !config.insecureTLS,
            timeout: config.requestTimeout
          }, async (res) => {
            try {
              const data = await collectResponseBody(res, config.maxResponseBytes, 'OAuth token response');
              debug('Token exchange response received', {
                statusCode: res.statusCode,
                dataLength: Buffer.byteLength(data)
              });

              // Check for error status codes
              if (res.statusCode === 401) {
                reject(createHttpError('Authentication failed: verify the configured API credentials', res.statusCode));
                return;
              }
              if (res.statusCode === 403) {
                reject(createHttpError('MCP access denied for the configured API credentials', res.statusCode));
                return;
              }
              if (res.statusCode !== 200) {
                reject(createHttpError(`Token exchange failed (HTTP ${res.statusCode})`, res.statusCode));
                return;
              }

              const parsedToken = parseOAuthTokenResponse(data);
              debug('Access token received successfully');
              resolve(parsedToken);
            } catch (responseError) {
              reject(responseError);
            }
          });

          req.once('error', reject);
          attachRequestTimeout(req, 'OAuth token request');
          req.write(tokenData);
          req.end();
        });
      },
      {
        maxRetries: config.maxRetries,
        operationName: 'Token exchange'
      }
    );

    accessToken = tokenResponse.accessToken;
    tokenExpiry = Date.now() + (tokenResponse.expiresInSeconds * 1000);

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
    error('OAuth flow failed', {
      errorType: err?.name,
      errorCode: err?.code,
      statusCode: err?.statusCode
    });
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
    } catch {
      debug('SSE data parse error');
      return null;
    }
  }

  return null;
}

/**
 * Builds the error for a failed backend HTTP response. Keeps the backend's own
 * JSON-RPC error or ProblemDetails message so the client sees why the call failed.
 * @param {number} statusCode
 * @param {string} responseData
 * @returns {ProxyTransportError} error with statusCode, plus jsonRpcError when the backend sent one
 */
function createBackendHttpError(statusCode, responseData) {
  let body = parseSSE(responseData);
  if (!body) {
    try {
      body = JSON.parse(responseData);
    } catch {
      body = null;
    }
  }

  const rpcError = body?.error;
  if (rpcError && Number.isInteger(rpcError.code) && typeof rpcError.message === 'string') {
    const transportError = createHttpError(rpcError.message, statusCode);
    transportError.jsonRpcError = rpcError;
    return transportError;
  }

  const detail = [body?.detail, body?.title, body?.message]
    .find(value => typeof value === 'string' && value.trim().length > 0);
  if (detail) {
    return createHttpError(
      `MCP request failed (HTTP ${statusCode}): ${detail.trim().slice(0, MAX_FORWARDED_ERROR_LENGTH)}`,
      statusCode
    );
  }

  return createHttpError(`MCP request failed (HTTP ${statusCode})`, statusCode);
}

/**
 * Posts one JSON-RPC message to the backend /mcp endpoint with the given token.
 * Each attempt has a total deadline: the socket `timeout` only fires on an idle
 * socket, so a backend that keeps sending bytes (e.g. SSE keepalives) would
 * otherwise hold the request open forever.
 * @param {object} request - JSON-RPC 2.0 request object
 * @param {string} requestId - Unique request ID for tracing
 * @param {string} data - Serialized request body
 * @param {string} token - OAuth access token
 * @returns {Promise<object|null>} JSON-RPC 2.0 response object, or null for an acknowledged notification
 */
function postToBackend(request, requestId, data, token) {
  return retryWithBackoff(
    async () => {
      return new Promise((resolvePromise, rejectPromise) => {
        let deadline;
        const resolve = value => {
          clearTimeout(deadline);
          resolvePromise(value);
        };
        const reject = err => {
          clearTimeout(deadline);
          rejectPromise(err);
        };

        const req = https.request(new URL(config.mcpPath, config.baseUrl), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'Content-Length': Buffer.byteLength(data),
            'X-Request-ID': requestId,
            ...buildMcpForwardHeaders(request)
          },
          // UTEAMUP-SEC-2026-05-02-008: see authorize handler above.
          rejectUnauthorized: !config.insecureTLS,
          timeout: config.requestTimeout
        }, async (res) => {
          try {
            const responseData = await collectResponseBody(res, config.maxResponseBytes, 'MCP response');
            trace('MCP response received', {
              requestId,
              statusCode: res.statusCode,
              dataLength: Buffer.byteLength(responseData)
            });

            if (res.statusCode >= 400) {
              reject(createBackendHttpError(res.statusCode, responseData));
              return;
            }

            // Handle empty responses (e.g., HTTP 202 for notifications)
            if (responseData.length === 0) {
              if (request.id === undefined || request.id === null) {
                trace('Notification acknowledged, no response needed', { requestId });
                resolve(null);
              } else {
                debug('Empty response received for a request', { requestId });
                resolve({
                  jsonrpc: '2.0',
                  error: { code: -32603, message: 'Backend returned an empty response' },
                  id: request.id
                });
              }
              return;
            }

            // Try parsing as SSE format first (text/event-stream)
            if (responseData.includes('event:') || responseData.includes('data:')) {
              debug('Detected SSE format, parsing...', { requestId });
              const parsed = parseSSE(responseData);
              if (parsed) {
                trace('SSE parsed successfully', {
                  requestId,
                  responseId: parsed?.id,
                  hasError: Boolean(parsed?.error)
                });
                resolve(parsed);
                return;
              }
            }

            // Fall back to plain JSON parsing
            try {
              const parsed = JSON.parse(responseData);
              trace('JSON parsed successfully', {
                requestId,
                responseId: parsed?.id,
                hasError: Boolean(parsed?.error)
              });
              resolve(parsed);
            } catch {
              debug('Parse error (not SSE, not JSON)', { requestId });
              resolve({
                jsonrpc: '2.0',
                error: { code: -32700, message: 'Backend returned an invalid response' },
                id: request.id
              });
            }
          } catch (responseError) {
            reject(responseError);
          }
        });

        req.once('error', reject);
        attachRequestTimeout(req, 'MCP request');
        deadline = setTimeout(() => {
          reject(new ProxyTransportError(`Backend did not answer within ${config.requestTimeout} ms`));
          req.destroy();
        }, config.requestTimeout);
        req.write(data);
        req.end();
      });
    },
    {
      maxRetries: getMcpRetryLimit(request.method, config.maxRetries),
      operationName: `MCP request [${request.method}]`
    }
  );
}

/**
 * Forwards a JSON-RPC 2.0 MCP request to the backend.
 * Handles both plain JSON and Server-Sent Events (SSE) response formats.
 * A 401 means the backend rejected the token before running anything, so the
 * request is replayed once with a fresh token (safe even for tools/call).
 * @param {object} request - JSON-RPC 2.0 request object
 * @param {string} requestId - Unique request ID for tracing
 * @returns {Promise<object>} JSON-RPC 2.0 response object
 */
async function forwardRequest(request, requestId) {
  const stopTimer = startTimer(`request_${request.method}`);

  try {
    const data = JSON.stringify(request);
    const requestBytes = Buffer.byteLength(data);
    if (requestBytes > config.maxRequestBytes) {
      throw new ProxyTransportError('Request exceeds the configured size limit');
    }

    trace('Forwarding MCP request', {
      requestId,
      method: request.method,
      id: request.id,
      bodyLength: requestBytes
    });

    let token = await getAccessToken();
    let response;
    try {
      response = await postToBackend(request, requestId, data, token);
    } catch (err) {
      if (err?.statusCode !== 401) throw err;

      info('Backend rejected the access token, re-authenticating once', { requestId });
      clearAccessToken(token);
      token = await getAccessToken();
      try {
        response = await postToBackend(request, requestId, data, token);
      } catch (retryErr) {
        if (retryErr?.statusCode !== 401) throw retryErr;
        clearAccessToken(token);
        throw createHttpError('Authentication failed: the backend rejected the access token', 401);
      }
    }

    const duration = stopTimer();
    recordRequest(true, duration, request.method);

    return response;
  } catch (err) {
    const duration = stopTimer();
    recordRequest(false, duration, request.method);
    error('Request forwarding failed', {
      requestId,
      method: request.method,
      errorType: err?.name,
      errorCode: err?.code,
      statusCode: err?.statusCode
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
      await getAccessToken();
      const duration = stopTimer();

      console.error('');
      console.error('✅ Authentication successful!');
      console.error(`   Token obtained in ${duration}ms`);
      console.error(`   Token expires: ${new Date(tokenExpiry).toISOString()}`);
      printMetrics();
      process.exit(0);
    } catch (err) {
      console.error('');
      console.error('❌ Authentication failed!');
      console.error(`   Error: ${toPublicErrorMessage(err)}`);
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

  const lineBuffer = new BoundedLineBuffer(config.maxRequestBytes);
  // Requests run concurrently so one slow tools/call cannot block the rest.
  // Each response is one stdout.write call, so messages never interleave.
  const inFlight = new Set();

  const writeErrorResponse = (code, message, id = null) => {
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      error: { code, message },
      id
    }) + '\n');
  };

  const processInputEvent = async inputEvent => {
    if (inputEvent.oversized) {
      writeErrorResponse(-32600, 'Request exceeds the configured size limit');
      return;
    }

    const line = inputEvent.line.trim();
    if (!line) return;

    const requestId = generateRequestId();
    let request;
    try {
      request = JSON.parse(line);
    } catch {
      writeErrorResponse(-32700, 'Parse error');
      return;
    }

    if (
      request === null ||
      Array.isArray(request) ||
      typeof request !== 'object' ||
      request.jsonrpc !== '2.0' ||
      typeof request.method !== 'string' ||
      request.method.length === 0
    ) {
      writeErrorResponse(-32600, 'Invalid Request', request?.id ?? null);
      return;
    }

    // Liveness check of this proxy: needs neither a token nor the backend.
    if (request.method === 'ping') {
      if (request.id !== undefined && request.id !== null) {
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {} }) + '\n');
      }
      return;
    }

    try {
      info('Processing request', {
        requestId,
        method: request.method,
        id: request.id
      });

      const response = await forwardRequest(request, requestId);

      // For notifications (null response), don't write anything to stdout.
      if (response === null) {
        debug('Notification handled, no response sent', { requestId });
        return;
      }

      // Ensure response includes request ID for proper JSON-RPC 2.0 format.
      if (request.id !== undefined && response.id === undefined) {
        response.id = request.id;
      }

      process.stdout.write(JSON.stringify(response) + '\n');
      trace('Response sent', { requestId, responseId: request.id });
    } catch (err) {
      error('Request processing error', {
        requestId,
        errorType: err?.name,
        errorCode: err?.code,
        statusCode: err?.statusCode
      });

      if (err?.jsonRpcError) {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          error: err.jsonRpcError,
          id: request.id ?? null
        }) + '\n');
      } else {
        writeErrorResponse(-32603, toPublicErrorMessage(err), request.id ?? null);
      }
    }
  };

  process.stdin.on('data', chunk => {
    for (const inputEvent of lineBuffer.push(chunk)) {
      const task = processInputEvent(inputEvent).finally(() => inFlight.delete(task));
      inFlight.add(task);
    }
  });

  // The client closing stdin means it is gone (e.g. a reconnect started a new
  // proxy). Give in-flight requests a short grace period, then exit even if one
  // is stuck, so this process never outlives its client.
  let exiting = false;
  const exitAfterInFlight = () => {
    if (exiting) return;
    exiting = true;
    info('stdin closed, exiting', { inFlight: inFlight.size, graceMs: STDIN_CLOSE_GRACE_MS });
    const grace = new Promise(resolve => setTimeout(resolve, STDIN_CLOSE_GRACE_MS));
    Promise.race([Promise.allSettled([...inFlight]), grace]).then(() => {
      printMetrics();
      process.exit(0);
    });
  };
  process.stdin.on('end', exitAfterInFlight);
  process.stdin.on('close', exitAfterInFlight);

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
  error('Uncaught exception', {
    errorType: err?.name,
    errorCode: err?.code
  });
  process.exit(1);
});

main().catch((err) => {
  error('Fatal error', {
    errorType: err?.name,
    errorCode: err?.code
  });
  process.exit(1);
});
