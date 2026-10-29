'use strict';
const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Nonserialized stock installation', () => {
  const base = 'https://api.uteamup.com';
  const itemGuid = '11111111-1111-4111-8111-111111111111';
  const assetGuid = '22222222-2222-4222-8222-222222222222';
  const cases = ['UteamupStockInstallItemOnAsset', 'UteamupStockUninstallItemFromAsset']
    .map(name => ({ name, args: { itemGuid, assetGuid, quantity: 1.25 } }));
  const call = (name, args, reply) => callMcpTool(base, 'stock-install-test-token', name, args, reply, args);
  beforeAll(() => nock.disableNetConnect());
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  afterAll(() => nock.enableNetConnect());

  for (const entry of cases) {
    test(`${entry.name} forwards exact public arguments and the transaction response`, async () => {
      const transaction = { guid: '33333333-3333-4333-8333-333333333333', stockItemGuid: itemGuid, quantity: 1.25 };
      const response = await call(entry.name, entry.args, successReply(transaction));
      expect(JSON.parse(response.body.result.content[0].text)).toEqual(transaction);
      expect(Object.keys(entry.args).sort()).toEqual(['assetGuid', 'itemGuid', 'quantity']);
      expect(nock.isDone()).toBe(true);
    });
    test(`${entry.name} preserves inaccessible-item and asset-authority errors`, async () => {
      for (const message of ['Stock item not found or not accessible.', 'Asset.View required']) {
        const response = await call(entry.name, entry.args, errorReply(-32602, message));
        expect(response.body.error.message).toBe(message);
      }
    });
  }
  describeJsonRpcCompliance(call, cases);
  describe401Unauthorized(base, cases);
  describe503ServiceUnavailable(base, cases);
});
