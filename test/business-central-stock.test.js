'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Native Business Central stock read', () => {
  const baseUrl = 'https://api.test.com';
  const args = { stockItemGuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
  const tools = [{ name: 'UteamupStockGetBusinessCentral', args }];
  const call = (name, values, reply) => callMcpTool(baseUrl, 'synthetic-token', name, values, reply);
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  test('preserves source identity, separate quantities and freshness', async () => {
    const data = { stockItemGuid: args.stockItemGuid, sku: '00100', localOnHand: 8,
      businessCentralItemGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      item: { number: '00100', companyOnHand: 24, baseUnitOfMeasureCode: 'PCS' },
      lastRefreshedAt: '2026-09-12T12:00:00Z', useEmulator: true, sharedCompanyQuantity: true };
    const response = await call(tools[0].name, args, successReply(data));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(data);
  });
  test('preserves an absent link', async () => {
    const response = await call(tools[0].name, args, successReply(null));
    expect(JSON.parse(response.body.result.content[0].text)).toBeNull();
  });
  test('does not turn Enterprise denial into stock data', async () => {
    const response = await call(tools[0].name, args, errorReply(-32603, 'Enterprise plan required'));
    expect(response.body.error.message).toContain('Enterprise');
  });
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
