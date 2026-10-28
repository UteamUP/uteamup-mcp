'use strict';
const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');

describe('Marketplace transaction RFQ origin', () => {
  beforeAll(() => nock.disableNetConnect());
  afterAll(() => nock.enableNetConnect());
  afterEach(() => nock.cleanAll());

  test('retains public origin references and null ordinary-order origins', async () => {
    const items = [
      { id: '11111111-1111-4111-8111-111111111111', sourceRequirementGuid: '22222222-2222-4222-8222-222222222222',
        sourceRequirementCode: 'REQ-4821', stockPurchaseOrderGuid: null },
      { id: '33333333-3333-4333-8333-333333333333', sourceRequirementGuid: null, sourceRequirementCode: null },
    ];
    const args = { page: 1, pageSize: 20 };
    const response = await callMcpTool('https://api.uteamup.com', 'test-token', 'UteamupMarketplaceTransactionsList',
      args, successReply({ items, totalItems: 2, page: 1, pageSize: 20 }), args);
    expect(JSON.parse(response.body.result.content[0].text).items).toEqual(items);
    expect(nock.isDone()).toBe(true);
  });
});
