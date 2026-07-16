/** GUID-only service price-list MCP proxy contracts. */

'use strict';

const nock = require('nock');
const {
  callMcpTool: callTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('service price-list MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_service_price_list';
  const priceListGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const ruleGuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const workTypeGuid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const asOf = '2026-07-16T12:00:00Z';

  const createModel = {
    idempotencyKey: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    name: 'Solid Energy field service',
    currency: 'ISK',
    effectiveFrom: '2026-07-01T00:00:00Z',
    effectiveTo: '2027-06-30T23:59:59Z',
    isActive: true,
    notes: 'Reviewed customer charge rules',
    items: [{
      name: 'Standard labour',
      ruleType: 'labor',
      unit: 'hour',
      rate: 18500,
      percentage: 0,
      recurrence: 'none',
      priority: 10,
      isActive: true,
      workTypeGuid,
      notes: 'Applies to planned field service',
    }],
  };

  const responseModel = {
    externalGuid: priceListGuid,
    name: createModel.name,
    currency: createModel.currency,
    effectiveFrom: createModel.effectiveFrom,
    effectiveTo: createModel.effectiveTo,
    isActive: true,
    isEffective: true,
    notes: createModel.notes,
    agreementCount: 2,
    approvedAgreementCount: 1,
    createdAt: '2026-07-01T08:00:00Z',
    updatedAt: '2026-07-01T08:00:00Z',
    items: [{
      externalGuid: ruleGuid,
      priceListGuid,
      name: createModel.items[0].name,
      ruleType: createModel.items[0].ruleType,
      unit: createModel.items[0].unit,
      rate: createModel.items[0].rate,
      percentage: 0,
      recurrence: createModel.items[0].recurrence,
      priority: createModel.items[0].priority,
      isActive: true,
      workTypeGuid,
      workTypeName: 'Planned maintenance',
      notes: createModel.items[0].notes,
    }],
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, args, reply) =>
    callTool(BASE_URL, ACCESS_TOKEN, toolName, args, reply, args);

  test.each([
    ['UteamupServicePriceListList', { activeOnly: true, asOf }, [responseModel]],
    ['UteamupServicePriceListGet', { priceListGuid, asOf }, responseModel],
    ['UteamupServicePriceListCreate', { model: createModel }, responseModel],
    [
      'UteamupServicePriceListUpdate',
      {
        priceListGuid,
        model: {
          ...createModel,
          idempotencyKey: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          expectedUpdatedAt: responseModel.updatedAt,
          items: [{ ...createModel.items[0], externalGuid: ruleGuid }],
        },
      },
      responseModel,
    ],
  ])('%s forwards arguments and preserves the GUID-safe contract', async (
    toolName,
    args,
    data,
  ) => {
    const result = await call(toolName, args, successReply(data));
    expect(result.status).toBe(200);
    const parsed = JSON.parse(result.body.result.content[0].text);
    expect(parsed).toEqual(data);
    expect(JSON.stringify(parsed)).not.toMatch(
      /"(?:id|tenantId|userId|priceListId|workTypeId|stockItemId)"/,
    );
    expect(args).not.toHaveProperty('tenantGuid');
    expect(args).not.toHaveProperty('userGuid');
  });

  test('preserves an empty list without fabricating price rules', async () => {
    const args = { activeOnly: true, asOf };
    const result = await call(
      'UteamupServicePriceListList',
      args,
      successReply([]),
    );

    expect(JSON.parse(result.body.result.content[0].text)).toEqual([]);
  });

  test('preserves backend JSON-RPC errors', async () => {
    const result = await call(
      'UteamupServicePriceListGet',
      { priceListGuid },
      errorReply(-32603, 'Price list unavailable'),
    );
    expect(result.body.error.code).toBe(-32603);
  });

  const tools = [
    { name: 'UteamupServicePriceListList', args: { activeOnly: false } },
    { name: 'UteamupServicePriceListGet', args: { priceListGuid } },
    { name: 'UteamupServicePriceListCreate', args: { model: createModel } },
    {
      name: 'UteamupServicePriceListUpdate',
      args: {
        priceListGuid,
        model: {
          ...createModel,
          idempotencyKey: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          expectedUpdatedAt: responseModel.updatedAt,
        },
      },
    },
  ];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
