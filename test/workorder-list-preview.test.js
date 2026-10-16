/**
 * Proxy contract tests for the backend UteamupWorkorderListPreview tool: the lists a new
 * workorder gets automatically from its resources under each list's workorder policy.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: callMcpToolRequest,
  successReply,
  errorReply
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
} = require('./helpers/mcp-error-tests');

describe('Workorder list preview MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_list_preview';
  const TOOL = 'UteamupWorkorderListPreview';
  const ASSET_GUID = '11111111-1111-4111-8111-111111111111';
  const GROUP_GUID = '22222222-2222-4222-8222-222222222222';
  const TOOL_GUID = '33333333-3333-4333-8333-333333333333';
  const ASSET_TYPE_GUID = '44444444-4444-4444-8444-444444444444';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    callMcpToolRequest(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  const preview = {
    checkLists: [
      { listGuid: '55555555-5555-4555-8555-555555555555', name: 'Pump isolation', sourceType: 'asset', sourceGuid: ASSET_GUID, sourceName: 'Feed pump' },
      { listGuid: '66666666-6666-4666-8666-666666666666', name: 'Vessel inspection', sourceType: 'asset_type', sourceGuid: ASSET_TYPE_GUID, sourceName: 'Pressure vessel' }
    ],
    taskLists: [
      { listGuid: '77777777-7777-4777-8777-777777777777', name: 'Torque check', sourceType: 'tool', sourceGuid: TOOL_GUID, sourceName: 'Torque wrench' }
    ]
  };

  test('forwards every resource GUID list and the maintenance type verbatim', async () => {
    const args = {
      assetGuids: [ASSET_GUID],
      assetGroupGuids: [GROUP_GUID],
      toolGuids: [TOOL_GUID],
      maintenanceType: 'CorrectiveDeferred'
    };
    const response = await call(TOOL, args, successReply(preview), args);

    const data = JSON.parse(response.body.result.content[0].text);
    expect(response.status).toBe(200);
    expect(data).toEqual(preview);
    expect(data.checkLists[1].sourceType).toBe('asset_type');
  });

  test('an empty preview round-trips as empty lists', async () => {
    const response = await call(TOOL, {}, successReply({ checkLists: [], taskLists: [] }));

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toEqual({ checkLists: [], taskLists: [] });
  });

  test('a foreign or inactive reference surfaces the backend error without crashing the proxy', async () => {
    const response = await call(
      TOOL,
      { assetGuids: [ASSET_GUID] },
      errorReply(-32000, 'AssetGuids contains an invalid or unavailable reference')
    );

    expect(response.body.error.message).toContain('invalid or unavailable');
  });

  const allTools = [{ name: TOOL, args: { assetGuids: [ASSET_GUID] } }];

  test('responses and fixtures carry no integer identifiers and no tenant or user spoofing args', () => {
    expect(JSON.stringify(preview)).not.toMatch(/"(id|listId|sourceId|assetId|tenantId)"/);
    for (const { args } of allTools) {
      expect(Object.keys(args)).not.toEqual(expect.arrayContaining(['tenantGuid']));
      expect(Object.keys(args)).not.toEqual(expect.arrayContaining(['userId']));
    }
  });

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
