'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Heat exposure MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_heat';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const reading = {
    guid: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    heatIndexC: 40.6,
    wbgtC: null,
  };

  describe('UteamupHeatexposureList tool', () => {
    test('returns tenant heat readings', async () => {
      const response = await call(
        'UteamupHeatexposureList',
        { skip: 0, take: 50 },
        successReply({ items: [reading], total: 1 }),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.total).toBe(1);
      expect(data.items[0].wbgtC).toBeNull();
    });
  });

  describeJsonRpcCompliance(call, [
    { name: 'UteamupHeatexposureList', args: { skip: 0, take: 10 } },
    { name: 'UteamupHeatexposureCreate', args: { locationGuid: reading.guid, dryBulbC: 32.2, relativeHumidityPct: 70 } },
  ]);
  describe401Unauthorized(BASE_URL, [
    { name: 'UteamupHeatexposureList', args: {} },
  ]);
  describe503ServiceUnavailable(BASE_URL, [
    { name: 'UteamupHeatexposureList', args: {} },
  ]);
});
