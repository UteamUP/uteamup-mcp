/**
 * Tenant AI control-plane MCP proxy contract tests.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('tenant AI control-plane MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_ai_governance';
  const TENANT_GUID = '11111111-2222-4333-8444-555555555555';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const tool = {
    name: 'UteamupGetTenantAIControlPlaneSnapshot',
    args: {},
  };

  test('passes through a masked GUID-first governance snapshot', async () => {
    const response = await call(tool.name, tool.args, successReply({
      tenantGuid: TENANT_GUID,
      tasks: [{ taskDefinitionGuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', stableKey: 'stock.forecast' }],
      connections: [{
        connectionGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        tenantGuid: TENANT_GUID,
        maskedSecret: '••••abcd',
        hasSecret: true,
      }],
      models: [],
      routes: [],
      coverage: { tenantGuid: TENANT_GUID, requiredTaskCount: 1, coveredTaskCount: 0 },
      policy: { tenantGuid: TENANT_GUID, isPaused: false },
    }));

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.tenantGuid).toBe(TENANT_GUID);
    expect(data.connections[0].maskedSecret).toBe('••••abcd');
    expect(data.connections[0].apiKey).toBeUndefined();
  });

  test('passes through an empty but valid snapshot', async () => {
    const response = await call(tool.name, tool.args, successReply({
      tenantGuid: TENANT_GUID,
      tasks: [], connections: [], models: [], routes: [],
      coverage: { tenantGuid: TENANT_GUID, tasks: [] },
      policy: { tenantGuid: TENANT_GUID },
    }));

    expect(response.status).toBe(200);
    expect(response.body.result).toBeDefined();
  });

  test('passes through permission denial', async () => {
    const response = await call(
      tool.name,
      tool.args,
      errorReply(-32000, 'Permission denied: AIProvider.Manage required'),
    );

    expect(response.body.error.message).toMatch(/AIProvider\.Manage/i);
  });

  const tools = [tool];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
