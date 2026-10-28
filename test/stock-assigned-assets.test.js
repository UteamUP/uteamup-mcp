'use strict';
const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');

describe('Stock item assigned assets', () => {
  const base = 'https://api.uteamup.com';
  const name = 'UteamupStockGetItemAssignedAssets';
  const args = { itemGuid: '11111111-1111-4111-8111-111111111111', page: 2, pageSize: 25 };
  beforeAll(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());
  afterAll(() => nock.enableNetConnect());

  test('preserves GUID-only usage summaries and page metadata', async () => {
    const body = { items: [{ assetGuid: '22222222-2222-4222-8222-222222222222', assetName: 'Pump' }],
      currentPage: 2, pageSize: 25, totalItems: 26, totalPages: 2 };
    const result = await callMcpTool(base, 'test-token', name, args, successReply(body), args);
    expect(JSON.parse(result.body.result.content[0].text)).toEqual(body);
    expect(nock.isDone()).toBe(true);
  });
  test.each(['Stock item not found.', 'Permission denied: Asset.View required.'])('preserves denial: %s', async message => {
    const result = await callMcpTool(base, 'test-token', name, args, errorReply(-32602, message), args);
    expect(result.body.error.message).toBe(message);
  });
});
