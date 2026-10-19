'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const proxyPath = path.resolve(__dirname, '..', 'index.js');
const externalGuid = '11111111-1111-4111-8111-111111111111';
const sourceGuid = '22222222-2222-4222-8222-222222222222';
const branchGuid = '33333333-3333-4333-8333-333333333333';
const model = {
  name: 'Pressure inspection',
  description: 'Inspect the seal when recorded pressure is high.',
  workorderMaintenanceTypes: [10, 12],
  items: [
    { externalGuid: sourceGuid, content: 'Pressure', order: 1, itemType: 'Measurement' },
    {
      externalGuid: branchGuid, content: 'Inspect seal', order: 2, itemType: 'Checkbox',
      condition: { dependsOnItemGuid: sourceGuid, operator: 'GreaterThan', value: '10', branch: 'Then' },
    },
  ],
};
const tools = [
  { name: 'UteamupChecklistCreate', args: { model } },
  { name: 'UteamupChecklistUpdate', args: { externalGuid, model } },
  { name: 'UteamupTasklistCreate', args: { model: { name: 'Isolation', description: 'Safe isolation', workorderMaintenanceTypes: [41], tasks: [] } } },
  { name: 'UteamupTasklistUpdate', args: { externalGuid, model: { name: 'Isolation', description: 'Safe isolation', workorderMaintenanceTypes: [] } } },
];

// Run the actual stdio proxy in an isolated child. Only the HTTP backend is
// mocked; OAuth, request forwarding, protocol output and errors are production code.
function runProxy(tool, status, backendReply, expectedCalls = 1) {
  const request = { jsonrpc: '2.0', id: 37, method: 'tools/call', params: { name: tool.name, arguments: tool.args } };
  const bootstrap = [
    'const nock = require("nock");',
    'const { isDeepStrictEqual } = require("node:util");',
    'nock.disableNetConnect();',
    'nock("https://api.test.com").get("/oauth/authorize").query(true).times(' + expectedCalls + ').reply(302, "", { location: "http://localhost:3000/callback?code=fixture-code" });',
    'nock("https://api.test.com").post("/oauth/token").times(' + expectedCalls + ').reply(200, { access_token: "fixture-access-token", token_type: "Bearer", expires_in: 3600 });',
    'let calls = 0;',
    'const expected = ' + JSON.stringify(request) + ';',
    'nock("https://api.test.com").matchHeader("Authorization", "Bearer fixture-access-token").post("/mcp", body => { calls++; return isDeepStrictEqual(body, expected); }).times(' + expectedCalls + ').reply(' + status + ', ' + JSON.stringify(backendReply) + ');',
    'process.on("exit", () => process.stderr.write("\\nPROXY_PROOF:" + JSON.stringify({ calls, pending: nock.pendingMocks() }) + "\\n"));',
    'require(' + JSON.stringify(proxyPath) + ');',
  ].join('\n');
  const child = spawnSync(process.execPath, ['-e', bootstrap], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      UTEAMUP_API_KEY: '12345678901234567890123456789012',
      UTEAMUP_SECRET: '1234567890123456789012345678901234567890123456789012345678901234',
      UTEAMUP_API_BASE_URL: 'https://api.test.com',
      UTEAMUP_LOG_LEVEL: 'ERROR',
      UTEAMUP_MAX_RETRIES: '3',
      UTEAMUP_TOKEN_CACHE_DIR: '',
    },
    input: JSON.stringify(request) + '\n',
    encoding: 'utf8',
    timeout: 10000,
  });
  expect(child.error).toBeUndefined();
  expect(child.status).toBe(0);
  const proof = child.stderr.match(/PROXY_PROOF:([^\n]+)/);
  expect(proof).not.toBeNull();
  expect(JSON.parse(proof[1])).toEqual({ calls: expectedCalls, pending: [] });
  return JSON.parse(child.stdout.trim());
}

describe('production MCP proxy: checklist workflows and required-list policies', () => {
  test.each(tools)('$name forwards nested models and returns the backend response', tool => {
    const backendReply = {
      jsonrpc: '2.0', id: 37,
      result: { content: [{ type: 'text', text: JSON.stringify({ externalGuid, ...tool.args.model }) }] },
    };
    expect(runProxy(tool, 200, backendReply)).toEqual(backendReply);
  });

  test('preserves backend validation rejection for a forward dependency', () => {
    const invalid = {
      name: 'UteamupChecklistUpdate',
      args: {
        externalGuid,
        model: {
          ...model,
          items: [
            { ...model.items[0], condition: { dependsOnItemGuid: branchGuid, operator: 'Equals', value: 'true', branch: 'Then' } },
            { ...model.items[1], condition: null },
          ],
        },
      },
    };
    const rejected = { jsonrpc: '2.0', id: 37, error: { code: -32602, message: 'A condition must reference an earlier step.' } };
    expect(runProxy(invalid, 200, rejected)).toEqual(rejected);
  });

  // A 401 clears the cached token and replays once with a fresh one before giving up.
  test.each(tools)('$name surfaces unauthorized access through JSON-RPC', tool => {
    expect(runProxy(tool, 401, 'Unauthorized', 2)).toEqual({
      jsonrpc: '2.0', id: 37,
      error: { code: -32603, message: 'Authentication failed: the backend rejected the access token' },
    });
  });

  test.each(tools)('$name does not retry mutations when the backend is unavailable', tool => {
    expect(runProxy(tool, 503, 'Unavailable')).toEqual({
      jsonrpc: '2.0', id: 37, error: { code: -32603, message: 'MCP request failed (HTTP 503)' },
    });
  });
});
