/** GUID-only operational service agreement MCP proxy contracts. */

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

describe('service agreement MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_service_agreement';
  const agreementGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const contractGuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const customerGuid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const assetGuid = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  const createModel = {
    idempotencyKey: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    contractGuid,
    customerGuid,
    effectiveFrom: '2026-02-01T00:00:00Z',
    effectiveTo: '2026-12-01T00:00:00Z',
    defaultResponseMinutes: 60,
    defaultResolutionMinutes: 480,
    pauseSlaOutsideBusinessHours: true,
    coverage: [{
      assetGuid,
      isIncluded: true,
      effectiveFrom: '2026-02-01T00:00:00Z',
    }],
  };

  const responseModel = {
    externalGuid: agreementGuid,
    contractGuid,
    contractTitle: 'Solid Energy service contract',
    customerGuid,
    customerName: 'Solid Energy',
    effectiveFrom: createModel.effectiveFrom,
    effectiveTo: createModel.effectiveTo,
    defaultResponseMinutes: 60,
    defaultResolutionMinutes: 480,
    pauseSlaOutsideBusinessHours: true,
    isApproved: false,
    currency: 'ISK',
    createdAt: '2026-07-16T12:00:00Z',
    updatedAt: '2026-07-16T12:00:00Z',
    coverage: [{
      externalGuid: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      assetGuid,
      assetName: 'Feed pump',
      isIncluded: true,
      effectiveFrom: createModel.effectiveFrom,
    }],
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, args, reply) =>
    callTool(BASE_URL, ACCESS_TOKEN, toolName, args, reply);

  test.each([
    ['UteamupServiceAgreementList', { activeOnly: true }, [responseModel]],
    ['UteamupServiceAgreementGet', { agreementGuid }, responseModel],
    ['UteamupServiceAgreementCreate', { model: createModel }, responseModel],
    [
      'UteamupServiceAgreementUpdate',
      {
        agreementGuid,
        model: {
          ...createModel,
          contractGuid: undefined,
          expectedUpdatedAt: responseModel.updatedAt,
        },
      },
      responseModel,
    ],
    [
      'UteamupServiceAgreementApprove',
      {
        agreementGuid,
        model: {
          idempotencyKey: '12121212-1212-4121-8121-121212121212',
          expectedUpdatedAt: responseModel.updatedAt,
        },
      },
      { ...responseModel, isApproved: true },
    ],
  ])('%s preserves the GUID-safe contract', async (toolName, args, data) => {
    const result = await call(toolName, args, successReply(data));
    expect(result.status).toBe(200);
    const parsed = JSON.parse(result.body.result.content[0].text);
    expect(parsed).toEqual(data);
    expect(JSON.stringify(parsed)).not.toMatch(
      /"(?:id|tenantId|contractId|customerId|assetId|locationId|workTypeCategoryId)"/,
    );
  });

  test('preserves backend JSON-RPC errors', async () => {
    const result = await call(
      'UteamupServiceAgreementGet',
      { agreementGuid },
      errorReply(-32603, 'Agreement unavailable'),
    );
    expect(result.body.error.code).toBe(-32603);
  });

  const tools = [
    { name: 'UteamupServiceAgreementList', args: { activeOnly: false } },
    { name: 'UteamupServiceAgreementGet', args: { agreementGuid } },
  ];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
