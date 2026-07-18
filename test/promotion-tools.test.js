'use strict';

const nock = require('nock');
const {
  callMcpTool: callMcpToolRaw,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Promotion MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_promotions';
  const promotionGuid = '11111111-1111-1111-1111-111111111111';
  const redemptionGuid = '22222222-2222-2222-2222-222222222222';
  const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    callMcpToolRaw(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const tools = [
    { name: 'UteamupPromotionList', args: {} },
    { name: 'UteamupPromotionGet', args: { guid: promotionGuid } },
    {
      name: 'UteamupPromotionCreate',
      args: {
        model: {
          name: 'One invoice',
          status: 'active',
          discountType: 'percentage',
          discountValue: 15,
          durationKind: 'once',
          maxRedemptionsPerTenant: 1,
        },
      },
    },
    {
      name: 'UteamupPromotionUpdate',
      args: {
        guid: promotionGuid,
        model: {
          name: 'Two invoices',
          status: 'active',
          discountType: 'percentage',
          discountValue: 15,
          durationKind: 'repeating',
          durationMonths: 2,
          maxRedemptionsPerTenant: 1,
        },
      },
    },
    { name: 'UteamupPromotionArchive', args: { guid: promotionGuid } },
    {
      name: 'UteamupPromotionGrant',
      args: { guid: promotionGuid, tenantGuid: tenantA, tenantGuids: [tenantB] },
    },
    {
      name: 'UteamupPromotionGrantAdhoc',
      args: {
        discountValue: 500,
        tenantGuid: tenantA,
        tenantGuids: [tenantB],
        discountType: 'fixedAmount',
        durationKind: 'once',
        currency: 'ISK',
      },
    },
    { name: 'UteamupPromotionRedemptions', args: { guid: promotionGuid } },
    { name: 'UteamupPromotionRevokeRedemption', args: { guid: redemptionGuid } },
  ];

  test.each(tools)('$name forwards its complete argument contract', async ({ name, args }) => {
    const response = await call(name, args, successReply({ tool: name, forwarded: true }));

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toEqual({ tool: name, forwarded: true });
  });

  test('one-time grant returns isolated outcomes for one plus multiple tenants', async () => {
    const outcomes = {
      results: [
        { tenantGuid: tenantA, success: true, redemption: { durationKind: 'once' } },
        { tenantGuid: tenantB, success: false, error: 'Tenant has no active subscription' },
      ],
      succeededCount: 1,
      failedCount: 1,
    };
    const response = await call(
      'UteamupPromotionGrantAdhoc',
      tools.find((tool) => tool.name === 'UteamupPromotionGrantAdhoc').args,
      successReply(outcomes),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.results).toHaveLength(2);
    expect(data.results[0].redemption.durationKind).toBe('once');
    expect(data.succeededCount).toBe(1);
    expect(data.failedCount).toBe(1);
  });

  test('list and redemptions preserve empty arrays', async () => {
    for (const tool of [
      { name: 'UteamupPromotionList', args: {} },
      { name: 'UteamupPromotionRedemptions', args: { guid: promotionGuid } },
    ]) {
      const response = await call(tool.name, tool.args, successReply([]));
      expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
    }
  });

  test('backend validation errors remain JSON-RPC errors', async () => {
    const response = await call(
      'UteamupPromotionGrantAdhoc',
      { discountValue: 5, tenantGuid: tenantA, discountType: 'fixedAmount', durationKind: 'once' },
      errorReply(-32602, 'Fixed-amount discount requires a currency.'),
    );

    expect(response.body.error.code).toBe(-32602);
    expect(response.body.error.message).toContain('requires a currency');
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
