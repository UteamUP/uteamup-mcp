'use strict';

const nock = require('nock');
const {
  callMcpTool: callMcpToolRequest,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Operational route GUID MCP contracts', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_operational_route_guid_token';
  const routeGuid = '11111111-1111-1111-1111-111111111111';
  const executionGuid = '22222222-2222-2222-2222-222222222222';
  const stopGuid = '33333333-3333-3333-3333-333333333333';
  const assetGuid = '44444444-4444-4444-4444-444444444444';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    callMcpToolRequest(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  test('round-trips GUID-only read arguments and responses', async () => {
    const response = await call(
      'UteamupOperationalRouteGet',
      { routeGuid },
      successReply({ guid: routeGuid, name: 'Plant rounds' }),
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toEqual({ guid: routeGuid, name: 'Plant rounds' });
    expect(data).not.toHaveProperty('id');
  });

  test('round-trips GUID-only execution mutation arguments', async () => {
    const response = await call(
      'UteamupInspectionStopComplete',
      {
        stopGuid,
        model: {
          stopGuid,
          result: 1,
          notes: 'Checked',
          checkListItems: [],
        },
      },
      successReply({
        guid: executionGuid,
        operationalRouteStopGuid: stopGuid,
        status: 2,
      }),
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.operationalRouteStopGuid).toBe(stopGuid);
    expect(data).not.toHaveProperty('id');
    expect(data).not.toHaveProperty('operationalRouteStopId');
  });

  test('returns empty anomaly lists without inventing data', async () => {
    const response = await call(
      'UteamupInspectionAnomalyList',
      { routeGuid, status: 'New' },
      successReply([]),
    );

    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });

  test('preserves JSON-RPC errors', async () => {
    const response = await call(
      'UteamupInspectionAssetHealthscore',
      { assetGuid },
      errorReply(-32602, 'Asset GUID not found'),
    );

    expect(response.body.error.code).toBe(-32602);
    expect(response.body.error.message).toContain('Asset GUID');
  });

  const tools = [
    { name: 'UteamupOperationalRouteGet', args: { routeGuid } },
    { name: 'UteamupInspectionExecutionGet', args: { executionGuid } },
    { name: 'UteamupInspectionStopComplete', args: { stopGuid, model: { stopGuid, result: 1 } } },
    { name: 'UteamupInspectionAssetHealthscore', args: { assetGuid } },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
