'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Filtered asset lifecycle MCP reads', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'asset-lifecycle-filter-token';
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('round-trips lifecycle event and asset GUID evidence', async () => {
    const response = await call(
      'UteamupAssetlifecycleGetByType',
      { eventType: 'Moved' },
      successReply([{
        guid: '11111111-1111-1111-1111-111111111111',
        assetGuid: '22222222-2222-2222-2222-222222222222',
        eventType: 'Moved',
      }]),
    );

    const [event] = JSON.parse(response.body.result.content[0].text);
    expect(event.guid).toBe('11111111-1111-1111-1111-111111111111');
    expect(event.assetGuid).toBe('22222222-2222-2222-2222-222222222222');
  });

  const tools = [
    { name: 'UteamupAssetlifecycleGetByType', args: { eventType: 'Moved' } },
    {
      name: 'UteamupAssetlifecycleGetByDateRange',
      args: {
        startDate: '2026-06-01T00:00:00Z',
        endDate: '2026-07-01T00:00:00Z',
      },
    },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
