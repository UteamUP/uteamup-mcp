'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Stock transaction historical quantities', () => {
  const BASE_URL = 'https://api.test.com';
  const args = { stockItemGuid: '55555555-5555-4555-8555-555555555555' };
  const name = 'UteamupStockGetTransactions';
  const call = (tool, input, reply) => callMcpTool(BASE_URL, 'test-token', tool, input, reply, input);
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('retains historical zero-to-14 and 14-to-two after later stock movements', async () => {
    const reply = await call(name, args, successReply([
      { action: 'Add', amount: 14, previousQuantity: 0, newQuantity: 14, hasQuantitySnapshot: true, currentOnHand: 5, transactionDate: '2026-11-01T19:40:00Z' },
      { action: 'Remove', amount: 12, previousQuantity: 14, newQuantity: 2, hasQuantitySnapshot: true, currentOnHand: 5, transactionDate: '2026-11-01T19:46:00Z' },
    ]));
    const result = JSON.parse(reply.body.result.content[0].text);
    expect(result[0].previousQuantity).toBe(0);
    expect(result[0].newQuantity).toBe(14);
    expect(result[1].previousQuantity).toBe(14);
    expect(result[1].newQuantity).toBe(2);
    expect(result[0].transactionDate).toBe('2026-11-01T19:40:00Z');
  });

  test.each(['Applied', 'PendingApproval', 'Rejected'])('unknown %s history is never coerced to zero', async (status) => {
    const reply = await call(name, args, successReply([{ status, hasQuantitySnapshot: false }]));
    const [row] = JSON.parse(reply.body.result.content[0].text);
    expect(row.hasQuantitySnapshot).toBe(false);
    expect(row).not.toHaveProperty('previousQuantity');
    expect(row).not.toHaveProperty('newQuantity');
    expect(row).not.toHaveProperty('transactionDate');
  });

  const tools = [{ name, args }];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
