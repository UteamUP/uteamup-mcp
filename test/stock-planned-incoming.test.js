'use strict';
const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Stock planned incoming', () => {
  const baseUrl = 'https://api.uteamup.com';
  const guid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const version = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const metadata = { quantity: 6, expectedDate: '2027-10-01', datePrecision: 'Month', notes: 'Stage1' };
  const tools = [
    { name: 'UteamupStockListPlannedIncoming', args: { stockItemGuid: guid, page: 2, pageSize: 25 } },
    { name: 'UteamupStockGetPlannedIncoming', args: { plannedIncomingGuid: guid } },
    { name: 'UteamupStockCreatePlannedIncoming', args: { stockItemGuid: guid, ...metadata } },
    { name: 'UteamupStockUpdatePlannedIncoming', args: { plannedIncomingGuid: guid, expectedVersionGuid: version, status: 'Received', ...metadata } },
    { name: 'UteamupStockConvertPlannedIncoming', args: { plannedIncomingGuid: guid, expectedVersionGuid: version } },
  ];
  const call = (name, args, reply) => callMcpTool(baseUrl, 'test-only-key', name, args, reply, args);
  beforeAll(() => nock.disableNetConnect());
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  afterAll(() => nock.enableNetConnect());
  it.each(tools)('$name preserves metadata and public GUIDs without inventing stock changes', async ({ name, args }) => {
    const body = name.includes('List') ? { items: [], plannedIncomingQuantity: 12, totalItems: 0, page: 2, pageSize: 25 }
      : { guid, versionGuid: version, ...metadata, status: 'Planned', purchaseOrderStatus: name.includes('Convert') ? 'Draft' : null };
    const response = await call(name, args, successReply(body));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(body);
    expect(nock.isDone()).toBe(true);
  });
  it.each(tools)('$name preserves permission and reviewed-version rejection', async ({ name, args }) => {
    const response = await call(name, args, errorReply(-32000, 'Plan access or reviewed version changed'));
    expect(response.body.error.message).toContain('reviewed version');
    expect(response.body.result).toBeUndefined();
  });
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
