'use strict';

const path = require('path');
const { spawn } = require('child_process');

const proxyPath = path.resolve(__dirname, '..', 'index.js');
const BASE_URL = 'https://api.test.com';
const TEST_TIMEOUT_MS = 20000;

const toolCall = id => ({
  jsonrpc: '2.0',
  id,
  method: 'tools/call',
  params: { name: 'UteamupAssetList', arguments: {} }
});
const success = id => ({
  jsonrpc: '2.0',
  id,
  result: { content: [{ type: 'text', text: '[]' }] }
});

/**
 * Runs the real stdio proxy in a child process. Only the HTTPS backend is mocked
 * (by the `backend` snippet); OAuth, forwarding, timeouts and shutdown are production code.
 * stdin stays open until `closeAfter` responses arrived, like a connected MCP client.
 * With `sequential`, each request is written only after the previous one was answered.
 */
function runProxy({ backend, requests, closeAfter = requests.length, sequential = false, env = {}, dropIdleTimeout = false }) {
  const bootstrap = [
    'const nock = require("nock");',
    'const https = require("https");',
    'const { Readable } = require("stream");',
    'nock.disableNetConnect();',
    `const BASE = ${JSON.stringify(BASE_URL)};`,
    'function oauth(token) {',
    '  nock(BASE).get("/oauth/authorize").query(true).reply(302, "", { location: "http://localhost:3000/callback?code=fixture-code" });',
    '  nock(BASE).post("/oauth/token").reply(200, { access_token: token, token_type: "Bearer", expires_in: 3600 });',
    '}',
    // A backend that holds the response open with SSE keepalives and never finishes it.
    'function trickle() {',
    '  const stream = new Readable({ read() {} });',
    '  const timer = setInterval(() => stream.push(": keepalive\\n\\n"), 200);',
    '  stream.on("close", () => clearInterval(timer));',
    '  return stream;',
    '}',
    // nock fires the socket idle timeout even while data flows; a real socket resets it on
    // every chunk, so in production it never fires for a trickling response. Drop it here
    // to reproduce that: only the total deadline can end the request.
    dropIdleTimeout
      ? 'const realRequest = https.request; https.request = (url, options, callback) => realRequest(url, { ...options, timeout: undefined }, callback);'
      : '',
    backend,
    'process.on("exit", () => process.stderr.write("\\nPROXY_PROOF:" + JSON.stringify({ pending: nock.pendingMocks() }) + "\\n"));',
    `require(${JSON.stringify(proxyPath)});`
  ].join('\n');

  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(process.execPath, ['-e', bootstrap], {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        UTEAMUP_API_KEY: '12345678901234567890123456789012',
        UTEAMUP_SECRET: '1234567890123456789012345678901234567890123456789012345678901234',
        UTEAMUP_API_BASE_URL: BASE_URL,
        UTEAMUP_LOG_LEVEL: 'ERROR',
        UTEAMUP_MAX_RETRIES: '3',
        UTEAMUP_TOKEN_CACHE_DIR: '',
        ...env
      }
    });

    let stdout = '';
    let stderr = '';
    let responses = [];
    let written = 0;
    const killTimer = setTimeout(() => child.kill('SIGKILL'), TEST_TIMEOUT_MS - 2000);

    const writeNext = () => {
      const batch = sequential ? requests.slice(written, written + 1) : requests.slice(written);
      written += batch.length;
      child.stdin.write(batch.map(request => JSON.stringify(request) + '\n').join(''));
      if (closeAfter === 0) child.stdin.end();
    };

    child.stdout.on('data', chunk => {
      stdout += chunk;
      const lines = stdout.split('\n');
      lines.pop();
      responses = lines.filter(Boolean).map(line => JSON.parse(line));
      if (responses.length >= closeAfter) {
        child.stdin.end();
      } else if (sequential && responses.length === written && written < requests.length) {
        writeNext();
      }
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('exit', (status, signal) => {
      clearTimeout(killTimer);
      const proof = stderr.match(/PROXY_PROOF:([^\n]+)/);
      resolve({
        status,
        signal,
        responses,
        elapsedMs: Date.now() - started,
        pending: proof ? JSON.parse(proof[1]).pending : null
      });
    });

    writeNext();
  });
}

describe('MCP proxy resilience (real stdio proxy, mocked backend)', () => {
  test('answers ping locally without a token or a backend call', async () => {
    const result = await runProxy({
      backend: '',
      requests: [{ jsonrpc: '2.0', id: 'ping-1', method: 'ping' }]
    });

    expect(result.status).toBe(0);
    expect(result.responses).toEqual([{ jsonrpc: '2.0', id: 'ping-1', result: {} }]);
    expect(result.pending).toEqual([]);
  }, TEST_TIMEOUT_MS);

  test.each([
    ['/mcp', `${BASE_URL}/mcp`],
    ['/mcp/read-only', `${BASE_URL}/mcp/read-only`]
  ])('requests a token bound to the %s endpoint it calls', async (mcpPath, resource) => {
    // The token mock only matches when the exchange names the MCP resource; without it the
    // exchange hits the disabled network and the call fails.
    const result = await runProxy({
      backend: [
        'nock(BASE).get("/oauth/authorize").query(true).reply(302, "", { location: "http://localhost:3000/callback?code=fixture-code" });',
        `nock(BASE).post("/oauth/token", body => body.resource === ${JSON.stringify(resource)}).reply(200, { access_token: "mcp-token", token_type: "Bearer", expires_in: 3600 });`,
        `nock(BASE).matchHeader("authorization", "Bearer mcp-token").post(${JSON.stringify(mcpPath)}).reply(200, ${JSON.stringify(success(1))});`
      ].join('\n'),
      requests: [toolCall(1)],
      env: { UTEAMUP_MCP_PATH: mcpPath }
    });

    expect(result.responses).toEqual([success(1)]);
    expect(result.pending).toEqual([]);
  }, TEST_TIMEOUT_MS);

  test('returns a JSON-RPC error instead of a fake success for an empty backend body', async () => {
    const result = await runProxy({
      backend: 'oauth("fixture-token"); nock(BASE).post("/mcp").reply(200, "");',
      requests: [toolCall(1)]
    });

    expect(result.status).toBe(0);
    expect(result.responses).toEqual([{
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32603, message: 'Backend returned an empty response' }
    }]);
    expect(result.pending).toEqual([]);
  }, TEST_TIMEOUT_MS);

  test('forwards the backend JSON-RPC error carried by an HTTP error response', async () => {
    const backendError = { code: -32602, message: 'Unknown tool: UteamupAssetList' };
    const result = await runProxy({
      backend: `oauth("fixture-token"); nock(BASE).post("/mcp").reply(400, ${JSON.stringify({ jsonrpc: '2.0', id: 1, error: backendError })});`,
      requests: [toolCall(1)]
    });

    expect(result.responses).toEqual([{ jsonrpc: '2.0', id: 1, error: backendError }]);
    expect(result.pending).toEqual([]);
  }, TEST_TIMEOUT_MS);

  test('includes the ProblemDetails message of an HTTP error response', async () => {
    const problem = {
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.4',
      title: 'Forbidden',
      status: 403,
      detail: 'The API key is not allowed to call this tool'
    };
    const result = await runProxy({
      backend: `oauth("fixture-token"); nock(BASE).post("/mcp").reply(403, ${JSON.stringify(problem)});`,
      requests: [toolCall(1)]
    });

    expect(result.responses).toEqual([{
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32603, message: 'MCP request failed (HTTP 403): The API key is not allowed to call this tool' }
    }]);
  }, TEST_TIMEOUT_MS);

  test('clears a rejected token, retries once with a fresh one, and keeps using the fresh one', async () => {
    // Exactly two OAuth rounds are mocked: a third (a later call re-using the rejected
    // token or re-authenticating again) would hit the disabled network and fail.
    const result = await runProxy({
      backend: [
        'oauth("stale-token");',
        'oauth("fresh-token");',
        'nock(BASE).matchHeader("authorization", "Bearer stale-token").post("/mcp").reply(401, "");',
        'nock(BASE).matchHeader("authorization", "Bearer fresh-token").post("/mcp").times(2).reply(200, (uri, body) => {',
        '  const { id } = typeof body === "string" ? JSON.parse(body) : body;',
        '  return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: "[]" }] } };',
        '});'
      ].join('\n'),
      requests: [toolCall(1), toolCall(2)],
      sequential: true
    });

    expect(result.status).toBe(0);
    expect(result.responses).toEqual([success(1), success(2)]);
    expect(result.pending).toEqual([]);
  }, TEST_TIMEOUT_MS);

  test('reports an authentication failure when the fresh token is rejected too', async () => {
    const result = await runProxy({
      backend: [
        'oauth("first-token");',
        'oauth("second-token");',
        'nock(BASE).post("/mcp").times(2).reply(401, "");'
      ].join('\n'),
      requests: [toolCall(1)]
    });

    expect(result.responses).toEqual([{
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32603, message: 'Authentication failed: the backend rejected the access token' }
    }]);
    expect(result.pending).toEqual([]);
  }, TEST_TIMEOUT_MS);

  test('ends a response that keeps trickling at the total deadline', async () => {
    const result = await runProxy({
      backend: 'oauth("fixture-token"); nock(BASE).post("/mcp").reply(200, () => trickle(), { "Content-Type": "text/event-stream" });',
      requests: [toolCall(1)],
      env: { UTEAMUP_REQUEST_TIMEOUT: '1000' },
      dropIdleTimeout: true
    });

    expect(result.status).toBe(0);
    expect(result.responses).toEqual([{
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32603, message: 'Backend did not answer within 1000 ms' }
    }]);
    expect(result.elapsedMs).toBeLessThan(8000);
  }, TEST_TIMEOUT_MS);

  test('a stalled call does not block a later call', async () => {
    const result = await runProxy({
      backend: [
        'oauth("fixture-token");',
        'nock(BASE).post("/mcp", body => body.id === 1).reply(200, () => trickle(), { "Content-Type": "text/event-stream" });',
        `nock(BASE).post("/mcp", body => body.id === 2).reply(200, ${JSON.stringify(success(2))});`
      ].join('\n'),
      requests: [toolCall(1), toolCall(2)],
      closeAfter: 1
    });

    expect(result.responses).toEqual([success(2)]);
    expect(result.pending).toEqual([]);
  }, TEST_TIMEOUT_MS);

  test('exits shortly after stdin closes even while a call is stuck', async () => {
    // Default 30 s deadline: only the stdin-close grace period can end this process in time.
    const result = await runProxy({
      backend: 'oauth("fixture-token"); nock(BASE).post("/mcp").reply(200, () => trickle(), { "Content-Type": "text/event-stream" });',
      requests: [toolCall(1)],
      closeAfter: 0
    });

    expect(result.signal).toBeNull();
    expect(result.status).toBe(0);
    expect(result.responses).toEqual([]);
    expect(result.elapsedMs).toBeLessThan(10000);
  }, TEST_TIMEOUT_MS);
});
