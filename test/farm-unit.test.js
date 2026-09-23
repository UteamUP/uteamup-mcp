'use strict';

const nock = require('nock');
const { callMcpTool: callTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Farm unit MCP read tools', () => {
  const baseUrl = 'https://api.test.com';
  const token = 'test_farm_unit_token';
  const unitGuid = '4c884c64-f4e6-4ddf-af04-a2c79f986cd0';
  const unit = {
    guid: unitGuid,
    name: 'North paddock',
    type: 'paddock',
    locationGuid: null,
    isActive: true,
  };
  const call = (name, args, reply) => callTool(baseUrl, token, name, args, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('list forwards filters and returns GUID-only units', async () => {
    const response = await call('UteamupFarmUnitList',
      { type: 'Paddock', isActive: true, page: 2, pageSize: 10 },
      successReply({ data: [unit], totalRecords: 11, page: 2, pageSize: 10, totalPages: 2 }));
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.data[0].guid).toBe(unitGuid);
    expect(data.data[0]).not.toHaveProperty('id');
  });

  test('empty list returns an empty data page', async () => {
    const response = await call('UteamupFarmUnitList', {},
      successReply({ data: [], totalRecords: 0, page: 1, pageSize: 25, totalPages: 0 }));
    expect(JSON.parse(response.body.result.content[0].text).data).toEqual([]);
  });

  test('get forwards the public GUID', async () => {
    const response = await call('UteamupFarmUnitGet', { unitGuid }, successReply(unit));
    expect(JSON.parse(response.body.result.content[0].text).guid).toBe(unitGuid);
  });

  test('backend error remains a JSON-RPC error', async () => {
    const response = await call('UteamupFarmUnitGet', { unitGuid },
      errorReply(-32603, 'Farm unit unavailable'));
    expect(response.body.error.code).toBe(-32603);
  });

  const tools = [
    { name: 'UteamupFarmUnitList', args: {} },
    { name: 'UteamupFarmUnitGet', args: { unitGuid } },
  ];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
