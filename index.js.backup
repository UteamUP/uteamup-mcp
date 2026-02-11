#!/usr/bin/env node

/**
 * UteamUP MCP Proxy - Simple OAuth handler
 * Usage: Set environment variables and run via npx or node
 */

const https = require('https');
const crypto = require('crypto');

// Configuration
const API_KEY = process.env.UTEAMUP_API_KEY;
const SECRET = process.env.UTEAMUP_SECRET;
const BASE_URL = process.env.UTEAMUP_API_BASE_URL || 'https://localhost:5002';
const DEBUG = process.env.UTEAMUP_DEBUG === '1' || process.env.UTEAMUP_DEBUG === 'true';

// Token cache
let accessToken = null;
let tokenExpiry = null;

/**
 * Debug logging helper (only outputs when UTEAMUP_DEBUG is enabled)
 * @param {...any} args - Arguments to log
 */
function debug(...args) {
  if (DEBUG) console.error('[DEBUG]', ...args);
}

/**
 * Generates a PKCE (Proof Key for Code Exchange) code verifier and challenge pair.
 * @returns {{verifier: string, challenge: string}} PKCE pair with S256 challenge
 */
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  debug('Generated PKCE pair:', { verifierLength: verifier.length, challengeLength: challenge.length });
  return { verifier, challenge };
}

/**
 * Gets an OAuth access token, using cached token if still valid.
 * Implements full OAuth 2.0 Authorization Code + PKCE flow.
 * @returns {Promise<string>} JWT access token valid for 7 days
 * @throws {Error} If authentication fails or credentials are invalid
 */
async function getAccessToken() {
  // Return cached token if still valid
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry - 60000) {
    debug('Using cached access token');
    return accessToken;
  }

  console.error('[MCP Proxy] Getting new access token...');

  const { verifier, challenge } = generatePKCE();

  // Step 1: Get authorization code
  const authCode = await new Promise((resolve, reject) => {
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: API_KEY,
      redirect_uri: 'http://localhost:3000/callback',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      scope: 'mcp:full'
    });

    debug('Authorization request params:', authParams.toString());

    https.get(`${BASE_URL}/oauth/authorize?${authParams}`, {
      rejectUnauthorized: false // Allow self-signed certs for dev
    }, (res) => {
      const location = res.headers.location || '';
      debug('Authorization redirect location:', location);

      // Check for OAuth error in redirect
      if (location.includes('error=')) {
        const url = new URL(location, 'http://localhost');
        const error = url.searchParams.get('error');
        const description = url.searchParams.get('error_description');
        reject(new Error(`OAuth authorization failed: ${error} - ${description || 'Unknown error'}`));
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

  console.error(`[MCP Proxy] Got auth code: ${authCode.substring(0, 20)}...`);

  // Step 2: Exchange for access token
  const tokenData = new URLSearchParams({
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: 'http://localhost:3000/callback',
    client_id: API_KEY,
    client_secret: SECRET,
    code_verifier: verifier
  }).toString();

  const token = await new Promise((resolve, reject) => {
    const req = https.request(`${BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(tokenData)
      },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        debug('Token exchange response status:', res.statusCode);
        debug('Token exchange response data:', data);

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

  accessToken = token;
  tokenExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
  console.error('[MCP Proxy] ✅ Got access token');
  debug('Token cached, expires at:', new Date(tokenExpiry).toISOString());

  return accessToken;
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
      debug('SSE data parse error:', e.message);
      return null;
    }
  }

  return null;
}

/**
 * Forwards a JSON-RPC 2.0 MCP request to the backend.
 * Handles both plain JSON and Server-Sent Events (SSE) response formats.
 * @param {object} request - JSON-RPC 2.0 request object
 * @returns {Promise<object>} JSON-RPC 2.0 response object
 */
async function forwardRequest(request) {
  const token = await getAccessToken();
  const data = JSON.stringify(request);

  debug('Forwarding request:', { method: request.method, id: request.id });

  return new Promise((resolve, reject) => {
    const req = https.request(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(data)
      },
      rejectUnauthorized: false
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        debug('MCP response received:', { statusCode: res.statusCode, dataLength: responseData.length });
        debug('MCP response body:', responseData);

        // Handle empty responses (e.g., HTTP 202 for notifications)
        if (responseData.length === 0) {
          debug('Empty response received (likely notification acknowledged)');
          // For notifications (no id), don't send a response
          if (request.id === undefined || request.id === null) {
            debug('Notification acknowledged, no response needed');
            resolve(null); // Don't send anything back for notifications
          } else {
            // For requests with ID, return success
            resolve({ jsonrpc: '2.0', result: {}, id: request.id });
          }
          return;
        }

        // Try parsing as SSE format first (text/event-stream)
        if (responseData.includes('event:') || responseData.includes('data:')) {
          debug('Detected SSE format, parsing...');
          const parsed = parseSSE(responseData);
          if (parsed) {
            debug('SSE parsed successfully:', JSON.stringify(parsed));
            resolve(parsed);
            return;
          }
        }

        // Fall back to plain JSON parsing
        try {
          const parsed = JSON.parse(responseData);
          debug('JSON parsed successfully:', JSON.stringify(parsed));
          resolve(parsed);
        } catch (e) {
          debug('Parse error (not SSE, not JSON):', e.message);
          resolve({
            jsonrpc: '2.0',
            error: { code: -32700, message: 'Parse error', data: responseData },
            id: request.id
          });
        }
      });
    });

    req.on('error', (error) => {
      console.error('[MCP Proxy] Network error:', error.message);
      resolve({ error: { code: -32603, message: error.message } });
    });

    req.write(data);
    req.end();
  });
}

// Main stdio loop
async function main() {
  // Validate required environment variables
  if (!API_KEY || !SECRET) {
    console.error('ERROR: Missing required environment variables');
    console.error('');
    console.error('Required:');
    console.error('  UTEAMUP_API_KEY    - Your MCP-enabled API key (32 characters)');
    console.error('  UTEAMUP_SECRET     - Your API key secret (64+ characters)');
    console.error('');
    console.error('Optional:');
    console.error('  UTEAMUP_API_BASE_URL - API endpoint (default: https://api.uteamup.com)');
    console.error('  UTEAMUP_DEBUG        - Enable debug logging (1 or true)');
    console.error('');
    console.error('Example:');
    console.error('  export UTEAMUP_API_KEY="your-api-key"');
    console.error('  export UTEAMUP_SECRET="your-secret"');
    console.error('  npx @uteamup/mcp-server');
    process.exit(1);
  }

  // Validate API key format (should be 32 chars)
  if (API_KEY.length !== 32) {
    console.error('WARNING: API Key should be exactly 32 characters');
    console.error(`  Current length: ${API_KEY.length}`);
  }

  // Validate secret format (should be 64+ chars)
  if (SECRET.length < 64) {
    console.error('WARNING: Secret should be at least 64 characters');
    console.error(`  Current length: ${SECRET.length}`);
  }

  console.error('[MCP Proxy] Starting UteamUP MCP Server');
  console.error(`[MCP Proxy] Version: 1.0.0-beta.6`);
  console.error(`[MCP Proxy] Base URL: ${BASE_URL}`);
  console.error(`[MCP Proxy] API Key: ${API_KEY.substring(0, 8)}...`);
  console.error(`[MCP Proxy] Debug: ${DEBUG ? 'enabled' : 'disabled'}`);
  console.error('[MCP Proxy] Ready to receive JSON-RPC requests');

  let buffer = '';

  process.stdin.on('data', async (chunk) => {
    buffer += chunk.toString();

    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (!line) continue;

      try {
        const request = JSON.parse(line);
        debug('Processing request:', request.method, 'id:', request.id);
        console.error(`[MCP Proxy] Request: ${request.method}`);

        const response = await forwardRequest(request);

        // For notifications (null response), don't write anything to stdout
        if (response === null) {
          debug('Notification handled, no response sent');
          continue;
        }

        // Ensure response includes request ID for proper JSON-RPC 2.0 format
        if (request.id !== undefined && response.id === undefined) {
          response.id = request.id;
        }

        process.stdout.write(JSON.stringify(response) + '\n');
        debug('Response sent for request id:', request.id);
      } catch (error) {
        console.error('[MCP Proxy] Error:', error.message);

        // Try to extract request ID if possible
        let requestId = null;
        try {
          const req = JSON.parse(line);
          requestId = req.id;
        } catch (e) {
          // Line wasn't valid JSON, use null
        }

        const errorResponse = {
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: error.message,
            data: DEBUG ? error.stack : undefined
          },
          id: requestId
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    }
  });

  process.stdin.on('end', () => {
    console.error('[MCP Proxy] stdin closed, exiting');
    process.exit(0);
  });

  process.stdin.resume();
}

// Graceful shutdown handlers
process.on('SIGINT', () => {
  console.error('[MCP Proxy] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[MCP Proxy] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('[MCP Proxy] Uncaught exception:', error.message);
  if (DEBUG) console.error(error.stack);
  process.exit(1);
});

main().catch((error) => {
  console.error('[MCP Proxy] Fatal error:', error);
  process.exit(1);
});
