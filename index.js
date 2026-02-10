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

// Token cache
let accessToken = null;
let tokenExpiry = null;

// Generate PKCE pair
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

// Get access token (with caching)
async function getAccessToken() {
  // Return cached token if still valid
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry - 60000) {
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

    https.get(`${BASE_URL}/oauth/authorize?${authParams}`, {
      rejectUnauthorized: false // Allow self-signed certs for dev
    }, (res) => {
      const location = res.headers.location || '';
      const match = location.match(/code=([^&]+)/);
      if (match) {
        resolve(match[1]);
      } else {
        reject(new Error('No authorization code in redirect'));
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
        try {
          const json = JSON.parse(data);
          if (json.accessToken) {
            resolve(json.accessToken);
          } else {
            reject(new Error(`Token exchange failed: ${data}`));
          }
        } catch (e) {
          reject(new Error(`Invalid JSON: ${data}`));
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

  return accessToken;
}

// Forward MCP request
async function forwardRequest(request) {
  const token = await getAccessToken();
  const data = JSON.stringify(request);

  return new Promise((resolve, reject) => {
    const req = https.request(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      rejectUnauthorized: false
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve({ error: { code: -32700, message: 'Parse error', data: responseData } });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ error: { code: -32603, message: error.message } });
    });

    req.write(data);
    req.end();
  });
}

// Main stdio loop
async function main() {
  if (!API_KEY || !SECRET) {
    console.error('ERROR: UTEAMUP_API_KEY and UTEAMUP_SECRET are required');
    process.exit(1);
  }

  console.error('[MCP Proxy] Starting MCP proxy server');
  console.error(`[MCP Proxy] Base URL: ${BASE_URL}`);
  console.error(`[MCP Proxy] API Key: ${API_KEY.substring(0, 8)}...`);

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
        console.error(`[MCP Proxy] Request: ${request.method}`);

        const response = await forwardRequest(request);
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (error) {
        const errorResponse = {
          jsonrpc: '2.0',
          error: { code: -32603, message: error.message },
          id: null
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    }
  });

  process.stdin.on('end', () => {
    process.exit(0);
  });

  process.stdin.resume();
}

main().catch((error) => {
  console.error('[MCP Proxy] Fatal error:', error);
  process.exit(1);
});
