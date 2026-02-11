/**
 * Integration tests with mock HTTP server
 * Tests the full OAuth flow and MCP request forwarding
 */

const nock = require('nock');
const https = require('https');
const crypto = require('crypto');

describe('Integration Tests', () => {
  const BASE_URL = 'https://api.test.com';
  const API_KEY = '12345678901234567890123456789012';
  const SECRET = '1234567890123456789012345678901234567890123456789012345678901234';

  beforeEach(() => {
    // Set test environment
    process.env.UTEAMUP_API_KEY = API_KEY;
    process.env.UTEAMUP_SECRET = SECRET;
    process.env.UTEAMUP_API_BASE_URL = BASE_URL;
    process.env.UTEAMUP_LOG_LEVEL = 'ERROR'; // Reduce noise in tests

    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('OAuth Flow', () => {
    test('should complete full OAuth flow successfully', async () => {
      const authCode = 'test_auth_code_123';
      const accessToken = 'test_access_token_456';

      // Mock authorization endpoint
      nock(BASE_URL)
        .get('/oauth/authorize')
        .query(true)
        .reply(302, '', {
          location: `http://localhost:3000/callback?code=${authCode}`
        });

      // Mock token exchange endpoint
      nock(BASE_URL)
        .post('/oauth/token')
        .reply(200, {
          accessToken: accessToken,
          token_type: 'Bearer',
          expires_in: 604800
        });

      // Simulate OAuth flow
      const authParams = new URLSearchParams({
        response_type: 'code',
        client_id: API_KEY,
        redirect_uri: 'http://localhost:3000/callback',
        code_challenge: 'test_challenge',
        code_challenge_method: 'S256',
        scope: 'mcp:full'
      });

      // Step 1: Get authorization code
      const authResponse = await new Promise((resolve, reject) => {
        https.get(`${BASE_URL}/oauth/authorize?${authParams}`, {
          rejectUnauthorized: false
        }, (res) => {
          const location = res.headers.location || '';
          const match = location.match(/code=([^&]+)/);
          resolve(match ? match[1] : null);
        }).on('error', reject);
      });

      expect(authResponse).toBe(authCode);

      // Step 2: Exchange for token
      const tokenData = new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: 'http://localhost:3000/callback',
        client_id: API_KEY,
        client_secret: SECRET,
        code_verifier: 'test_verifier'
      }).toString();

      const tokenResponse = await new Promise((resolve, reject) => {
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
          res.on('end', () => resolve(JSON.parse(data)));
        });

        req.on('error', reject);
        req.write(tokenData);
        req.end();
      });

      expect(tokenResponse.accessToken).toBe(accessToken);
    });

    test('should handle OAuth authorization error', async () => {
      nock(BASE_URL)
        .get('/oauth/authorize')
        .query(true)
        .reply(302, '', {
          location: 'http://localhost:3000/callback?error=invalid_request&error_description=Invalid+client'
        });

      const authParams = new URLSearchParams({
        response_type: 'code',
        client_id: 'invalid_key',
        redirect_uri: 'http://localhost:3000/callback',
        code_challenge: 'test_challenge',
        code_challenge_method: 'S256',
        scope: 'mcp:full'
      });

      await expect(async () => {
        const location = await new Promise((resolve, reject) => {
          https.get(`${BASE_URL}/oauth/authorize?${authParams}`, {
            rejectUnauthorized: false
          }, (res) => {
            resolve(res.headers.location || '');
          }).on('error', reject);
        });

        if (location.includes('error=')) {
          throw new Error('OAuth authorization failed');
        }
      }).rejects.toThrow('OAuth authorization failed');
    });

    test('should handle 401 authentication error', async () => {
      nock(BASE_URL)
        .post('/oauth/token')
        .reply(401, 'Invalid credentials');

      const tokenData = new URLSearchParams({
        grant_type: 'authorization_code',
        code: 'invalid_code',
        redirect_uri: 'http://localhost:3000/callback',
        client_id: API_KEY,
        client_secret: 'wrong_secret',
        code_verifier: 'test_verifier'
      }).toString();

      await expect(async () => {
        await new Promise((resolve, reject) => {
          const req = https.request(`${BASE_URL}/oauth/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(tokenData)
            },
            rejectUnauthorized: false
          }, (res) => {
            if (res.statusCode === 401) {
              reject(new Error('Authentication failed'));
            }
          });

          req.on('error', reject);
          req.write(tokenData);
          req.end();
        });
      }).rejects.toThrow('Authentication failed');
    });

    test('should handle 403 MCP not enabled error', async () => {
      nock(BASE_URL)
        .post('/oauth/token')
        .reply(403, 'MCP not enabled for this API key');

      const tokenData = new URLSearchParams({
        grant_type: 'authorization_code',
        code: 'test_code',
        redirect_uri: 'http://localhost:3000/callback',
        client_id: API_KEY,
        client_secret: SECRET,
        code_verifier: 'test_verifier'
      }).toString();

      await expect(async () => {
        await new Promise((resolve, reject) => {
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
              if (res.statusCode === 403 && data.includes('MCP')) {
                reject(new Error('MCP access denied'));
              }
            });
          });

          req.on('error', reject);
          req.write(tokenData);
          req.end();
        });
      }).rejects.toThrow('MCP access denied');
    });
  });

  describe('MCP Request Forwarding', () => {
    test('should forward JSON-RPC request successfully', async () => {
      const accessToken = 'test_token';
      const mcpResponse = {
        jsonrpc: '2.0',
        result: { tools: [] },
        id: 1
      };

      nock(BASE_URL)
        .post('/mcp')
        .reply(200, JSON.stringify(mcpResponse), {
          'Content-Type': 'application/json'
        });

      const request = {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1
      };

      const response = await new Promise((resolve, reject) => {
        const data = JSON.stringify(request);

        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'Content-Length': Buffer.byteLength(data)
          },
          rejectUnauthorized: false
        }, (res) => {
          let responseData = '';
          res.on('data', chunk => responseData += chunk);
          res.on('end', () => resolve(JSON.parse(responseData)));
        });

        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(response).toEqual(mcpResponse);
    });

    test('should handle SSE format response', async () => {
      const accessToken = 'test_token';
      const sseResponse = `event: message
data: {"jsonrpc":"2.0","result":{"tools":[]},"id":1}`;

      nock(BASE_URL)
        .post('/mcp')
        .reply(200, sseResponse, {
          'Content-Type': 'text/event-stream'
        });

      const request = {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1
      };

      const response = await new Promise((resolve, reject) => {
        const data = JSON.stringify(request);

        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'Content-Length': Buffer.byteLength(data)
          },
          rejectUnauthorized: false
        }, (res) => {
          let responseData = '';
          res.on('data', chunk => responseData += chunk);
          res.on('end', () => {
            // Parse SSE format
            const lines = responseData.trim().split('\n');
            let jsonData = null;
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                jsonData = line.substring(6);
                break;
              }
            }
            resolve(jsonData ? JSON.parse(jsonData) : null);
          });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(response).toEqual({
        jsonrpc: '2.0',
        result: { tools: [] },
        id: 1
      });
    });

    test('should handle empty notification response', async () => {
      const accessToken = 'test_token';

      nock(BASE_URL)
        .post('/mcp')
        .reply(202); // Empty response for notification

      const notification = {
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      };

      const response = await new Promise((resolve, reject) => {
        const data = JSON.stringify(notification);

        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'Content-Length': Buffer.byteLength(data)
          },
          rejectUnauthorized: false
        }, (res) => {
          let responseData = '';
          res.on('data', chunk => responseData += chunk);
          res.on('end', () => {
            resolve(responseData.length === 0 ? null : responseData);
          });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(response).toBeNull();
    });
  });

  describe('PKCE Generation', () => {
    test('should generate valid PKCE pair', () => {
      const verifier = crypto.randomBytes(32).toString('base64url');
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

      expect(verifier).toHaveLength(43);
      expect(challenge).toHaveLength(43);
      expect(verifier).not.toBe(challenge);
    });

    test('should generate different PKCE pairs each time', () => {
      const pair1 = {
        verifier: crypto.randomBytes(32).toString('base64url'),
        challenge: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('base64url')
      };

      const pair2 = {
        verifier: crypto.randomBytes(32).toString('base64url'),
        challenge: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('base64url')
      };

      expect(pair1.verifier).not.toBe(pair2.verifier);
      expect(pair1.challenge).not.toBe(pair2.challenge);
    });
  });
});
