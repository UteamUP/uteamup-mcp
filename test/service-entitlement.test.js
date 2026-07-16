/** GUID-only service entitlement MCP proxy contracts. */

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

describe('service entitlement MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_service_entitlement';
  const entitlementGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const agreementGuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const contractGuid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const customerGuid = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const sourceGuid = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const usageGuid = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const asOf = '2026-07-16T12:00:00Z';

  const createModel = {
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
    agreementGuid,
    name: 'Monthly labour',
    unit: 'laborMinutes',
    includedQuantity: 120,
    period: 'calendarMonth',
    effectiveFrom: '2026-07-01T00:00:00Z',
    effectiveTo: '2027-06-30T23:59:59Z',
    isActive: true,
  };

  const usageModel = {
    idempotencyKey: '22222222-2222-4222-8222-222222222222',
    sourceType: 'timeEntry',
    sourceGuid,
    quantity: 45,
    occurredAt: '2026-07-10T12:00:00Z',
  };

  const usageResponse = {
    externalGuid: usageGuid,
    entitlementGuid,
    sourceType: usageModel.sourceType,
    sourceGuid,
    quantity: usageModel.quantity,
    occurredAt: usageModel.occurredAt,
    entitlementNameSnapshot: createModel.name,
    unitSnapshot: createModel.unit,
    periodSnapshot: createModel.period,
    includedQuantitySnapshot: createModel.includedQuantity,
    createdAt: '2026-07-10T12:05:00Z',
  };

  const responseModel = {
    externalGuid: entitlementGuid,
    agreementGuid,
    agreementTitle: 'Solid Energy service contract',
    contractGuid,
    customerGuid,
    customerName: 'Solid Energy',
    name: createModel.name,
    unit: createModel.unit,
    includedQuantity: createModel.includedQuantity,
    period: createModel.period,
    effectiveFrom: createModel.effectiveFrom,
    effectiveTo: createModel.effectiveTo,
    isActive: true,
    isEffective: true,
    balanceAsOf: asOf,
    periodStart: '2026-07-01T00:00:00Z',
    periodEnd: '2026-07-31T23:59:59Z',
    consumedQuantity: 45,
    remainingQuantity: 75,
    overageQuantity: 0,
    createdAt: '2026-07-01T08:00:00Z',
    updatedAt: '2026-07-01T08:00:00Z',
    usage: [usageResponse],
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, args, reply) =>
    callTool(BASE_URL, ACCESS_TOKEN, toolName, args, reply);

  test.each([
    ['UteamupServiceEntitlementList', { agreementGuid, asOf }, [responseModel]],
    ['UteamupServiceEntitlementGet', { entitlementGuid, asOf }, responseModel],
    ['UteamupServiceEntitlementCreate', { model: createModel }, responseModel],
    [
      'UteamupServiceEntitlementUpdate',
      {
        entitlementGuid,
        model: {
          ...createModel,
          agreementGuid: undefined,
          expectedUpdatedAt: responseModel.updatedAt,
        },
      },
      responseModel,
    ],
    [
      'UteamupServiceEntitlementUsageRecord',
      { entitlementGuid, model: usageModel },
      usageResponse,
    ],
    [
      'UteamupServiceEntitlementUsageReverse',
      {
        usageGuid,
        model: {
          idempotencyKey: '33333333-3333-4333-8333-333333333333',
          reason: 'Duplicate time entry',
        },
      },
      { ...usageResponse, sourceType: 'reversal', quantity: -45 },
    ],
  ])('%s preserves the GUID-safe contract', async (toolName, args, data) => {
    const result = await call(toolName, args, successReply(data));
    expect(result.status).toBe(200);
    const parsed = JSON.parse(result.body.result.content[0].text);
    expect(parsed).toEqual(data);
    expect(JSON.stringify(parsed)).not.toMatch(
      /"(?:id|tenantId|agreementId|contractId|customerId|entitlementId|sourceId)"/,
    );
  });

  test('preserves backend JSON-RPC errors', async () => {
    const result = await call(
      'UteamupServiceEntitlementGet',
      { entitlementGuid },
      errorReply(-32603, 'Entitlement unavailable'),
    );
    expect(result.body.error.code).toBe(-32603);
  });

  const tools = [
    { name: 'UteamupServiceEntitlementList', args: { agreementGuid } },
    { name: 'UteamupServiceEntitlementGet', args: { entitlementGuid } },
  ];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
