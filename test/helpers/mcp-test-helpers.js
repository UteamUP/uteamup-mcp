'use strict';

const nock = require('nock');
const https = require('https');
const { isDeepStrictEqual } = require('node:util');

const TEST_BASE_URL = 'https://api.test.com';

/**
 * Send a JSON-RPC 2.0 tools/call to /mcp via nock-mocked HTTPS.
 */
function callMcpTool(baseUrl, accessToken, toolName, toolArgs, mockReply, expectedArgs) {
  nock(baseUrl)
    .post('/mcp', body => (
      body.method === 'tools/call'
      && body.params?.name === toolName
      && (expectedArgs === undefined
        || isDeepStrictEqual(body.params?.arguments, expectedArgs))
    ))
    .reply(mockReply.status, JSON.stringify(mockReply.body), {
      'Content-Type': 'application/json'
    });

  const request = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: { name: toolName, arguments: toolArgs },
    id: Math.floor(Math.random() * 10000)
  };

  return new Promise((resolve, reject) => {
    const data = JSON.stringify(request);
    const req = https.request(`${baseUrl}/mcp`, {
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
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseData) });
        } catch {
          resolve({ status: res.statusCode, body: responseData });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Send a raw JSON-RPC request and return only the status code.
 * Used by 401/503 tests that only care about HTTP status.
 */
function sendRawRequest(baseUrl, toolName, toolArgs, id) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: toolArgs },
      id: id ?? Math.floor(Math.random() * 9000) + 1000
    });

    const req = https.request(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      rejectUnauthorized: false
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/** Build a JSON-RPC 2.0 success mock reply */
function successReply(data, id = 1) {
  return {
    status: 200,
    body: {
      jsonrpc: '2.0',
      result: { content: [{ type: 'text', text: JSON.stringify(data) }] },
      id
    }
  };
}

/** Build a JSON-RPC 2.0 error mock reply */
function errorReply(code, message, id = 1) {
  return {
    status: 200,
    body: {
      jsonrpc: '2.0',
      error: { code, message },
      id
    }
  };
}

module.exports = {
  TEST_BASE_URL,
  callMcpTool,
  sendRawRequest,
  successReply,
  errorReply
};
