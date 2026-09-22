'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Asset lifecycle workspace MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'asset-lifecycle-workspace-token';
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('round-trips monitoring health and exact per-item setup outcomes', async () => {
    const workspace = await call(
      'UteamupAssetLifecycleWorkspaceGet',
      {},
      successReply({ monitoring: { status: 'Healthy' }, openFindingCount: 2 }),
    );
    expect(JSON.parse(workspace.body.result.content[0].text).monitoring.status).toBe('Healthy');

    const result = await call(
      'UteamupAssetLifecycleSetupBulkApply',
      { model: { assetGuids: ['11111111-1111-1111-1111-111111111111'] } },
      successReply({ completedCount: 1, failedCount: 0 }),
    );
    expect(JSON.parse(result.body.result.content[0].text).completedCount).toBe(1);
  });

  const tools = [
    { name: 'UteamupAssetLifecycleWorkspaceGet', args: {} },
    {
      name: 'UteamupAssetLifecycleSetupGet',
      args: { assetGuid: '11111111-1111-1111-1111-111111111111' },
    },
    {
      name: 'UteamupAssetLifecycleSetupApply',
      args: {
        assetGuid: '11111111-1111-1111-1111-111111111111',
        model: { profileKey: 'basic' },
      },
    },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
