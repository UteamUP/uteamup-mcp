'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Safety incident MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_safety';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const incident = {
    guid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    incidentNumber: 'INC-2025-0001',
    isRecordable: null,
    oshaNotifyIsEmployerDuty: true,
  };

  describe('UteamupSafetyincidentList tool', () => {
    test('returns tenant incidents without auto-filing copy', async () => {
      const response = await call(
        'UteamupSafetyincidentList',
        { skip: 0, take: 50 },
        successReply({ items: [incident], total: 1 }),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.total).toBe(1);
      expect(data.items[0].incidentNumber).toBe('INC-2025-0001');
    });
  });

  describeJsonRpcCompliance(call, [
    { name: 'UteamupSafetyincidentList', args: { skip: 0, take: 10 } },
    { name: 'UteamupSafetyincidentGet', args: { incidentGuid: incident.guid } },
  ]);
  describe401Unauthorized(BASE_URL, [
    { name: 'UteamupSafetyincidentList', args: {} },
  ]);
  describe503ServiceUnavailable(BASE_URL, [
    { name: 'UteamupSafetyincidentList', args: {} },
  ]);
});
