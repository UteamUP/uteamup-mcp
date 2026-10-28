'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Part stock levels GUID contract', () => {
  const baseUrl = 'https://api.uteamup.com';
  const partGuid = '57d008b4-6ef9-4261-aacd-1ee2bfeb5bd4';
  const tool = 'UteamupPartGetStockLevels';
  const call = (args, reply, expectedArgs) => callMcpTool(baseUrl, 'synthetic-part-stock-token', tool, args, reply, expectedArgs);
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  it('preserves real stock quantities, thresholds and public GUIDs', async () => {
    const args = { partGuid };
    const response = await call(args, successReply({ partGuid, partName: 'AA battery', totalQuantity: 0,
      locations: [{ stockGuid: '89745e43-8a50-4888-b9c1-a1c4d99bbcdc', stockName: 'Vesturberg 111', quantity: 0, lowStockThreshold: 6, isLowStock: true }] }), args);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.partGuid).toBe(partGuid);
    expect(data.locations[0]).toMatchObject({ quantity: 0, lowStockThreshold: 6, isLowStock: true });
    expect(data).not.toHaveProperty('partId');
    expect(data.locations[0]).not.toHaveProperty('locationId');
  });

  it('returns an empty list when no readable stock exists', async () => {
    const response = await call({ partGuid }, successReply({ partGuid, locations: [], totalQuantity: 0 }));
    expect(JSON.parse(response.body.result.content[0].text).locations).toEqual([]);
  });

  it('preserves a stock-permission refusal', async () => {
    const response = await call({ partGuid }, errorReply(-32603, 'Permission denied: Stock.View required'));
    expect(response.body.error.message).toContain('Stock.View');
  });

  describeJsonRpcCompliance((name, args, reply) => callMcpTool(baseUrl, 'synthetic-part-stock-token', name, args, reply), [{ name: tool, args: { partGuid } }]);
  describe401Unauthorized(baseUrl, [{ name: tool, args: { partGuid } }]);
  describe503ServiceUnavailable(baseUrl, [{ name: tool, args: { partGuid } }]);
});
