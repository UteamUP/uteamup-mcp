'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Historical stock removal asset attribution', () => {
  const BASE_URL = 'https://api.test.com';
  const args = { transactionGuid: '11111111-1111-4111-8111-111111111111', assetGuid: '22222222-2222-4222-8222-222222222222' };
  const name = 'UteamupStockTransactionLinkAsset';
  const call = (tool, input, reply) => callMcpTool(BASE_URL, 'test-token', tool, input, reply, input);
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('returns attribution without inventing another withdrawal', async () => {
    const reply = await call(name, args, successReply({ guid: args.transactionGuid, assetGuid: args.assetGuid,
      action: 'Remove', amount: 1, previousQuantity: 14, newQuantity: 13, hasQuantitySnapshot: true }));
    const result = JSON.parse(reply.body.result.content[0].text);
    expect(result.guid).toBe(args.transactionGuid);
    expect(result.assetGuid).toBe(args.assetGuid);
    expect(result.newQuantity).toBe(13);
  });
  test('preserves a refusal to reattribute or use a nonordinary movement', async () => {
    const reply = await call(name, args, errorReply(-32602, 'transaction_asset_locked'));
    expect(reply.body.error.message).toContain('transaction_asset_locked');
  });
  const tools = [{ name, args }];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
