/**
 * Shift-handover carry-over MCP proxy contracts.
 *
 * The proxy remains generic; these tests guard the backend-owned GUID identities,
 * concurrency tokens, idempotent conversion key, and provenance response.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  errorReply,
  sendRawRequest,
  successReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Shift-handover carry-over MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_shift_handover_carryovers';
  const HANDOVER_GUID = '11111111-1111-4111-8111-111111111111';
  const CARRY_OVER_GUID = '22222222-2222-4222-8222-222222222222';
  const WORKORDER_GUID = '33333333-3333-4333-8333-333333333333';
  const IDEMPOTENCY_KEY = '44444444-4444-4444-8444-444444444444';
  const ORIGINAL_TOKEN = 'handover-token-original';
  const CREATED_TOKEN = 'handover-token-created';
  const UPDATED_TOKEN = 'handover-token-updated';

  const getArgs = { handoverGuid: HANDOVER_GUID };
  const createArgs = {
    handoverGuid: HANDOVER_GUID,
    model: {
      description: 'Inspect pump seal on the next shift.',
      priority: 1,
      originalShiftHandoverGuid: null,
      concurrencyToken: ORIGINAL_TOKEN,
    },
  };
  const updateArgs = {
    handoverGuid: HANDOVER_GUID,
    carryOverGuid: CARRY_OVER_GUID,
    model: {
      description: 'Pump seal inspected; monitor for two hours.',
      status: 'resolved',
      priority: 1,
      concurrencyToken: CREATED_TOKEN,
    },
  };
  const deleteArgs = {
    handoverGuid: HANDOVER_GUID,
    carryOverGuid: CARRY_OVER_GUID,
    concurrencyToken: UPDATED_TOKEN,
  };
  const convertArgs = {
    handoverGuid: HANDOVER_GUID,
    carryOverGuid: CARRY_OVER_GUID,
    concurrencyToken: UPDATED_TOKEN,
    idempotencyKey: IDEMPOTENCY_KEY,
  };

  const tools = [
    { name: 'UteamupShiftHandoverGetCarryOvers', args: getArgs },
    { name: 'UteamupShiftHandoverCreateCarryOver', args: createArgs },
    { name: 'UteamupShiftHandoverUpdateCarryOver', args: updateArgs },
    { name: 'UteamupShiftHandoverDeleteCarryOver', args: deleteArgs },
    { name: 'UteamupShiftHandoverConvertCarryOverToWorkOrder', args: convertArgs },
  ];

  const carryOver = {
    guid: CARRY_OVER_GUID,
    shiftHandoverGuid: HANDOVER_GUID,
    originalShiftHandoverGuid: null,
    description: 'Inspect pump seal on the next shift.',
    carryOverCount: 2,
    status: 'escalated',
    workOrderGuid: null,
    priority: 1,
    resolvedAt: null,
    createdAt: '2026-07-12T08:00:00Z',
    updatedAt: '2026-07-12T08:05:00Z',
    handoverConcurrencyToken: UPDATED_TOKEN,
  };
  const forbiddenIntegerIdentityKeys = new Set([
    'id',
    'handoverId',
    'shiftHandoverId',
    'carryOverId',
    'workOrderId',
    'tenantId',
    'createdById',
    'updatedById',
  ]);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const captureCall = async (toolName, toolArgs) => {
    let captured = null;
    nock(BASE_URL)
      .post('/mcp', body => {
        captured = body;
        return body.method === 'tools/call' && body.params?.name === toolName;
      })
      .reply(200, JSON.stringify(successReply({}).body), {
        'Content-Type': 'application/json',
      });
    await sendRawRequest(BASE_URL, toolName, toolArgs);
    return captured;
  };

  const expectNoIntegerIdentity = value => {
    if (Array.isArray(value)) {
      value.forEach(expectNoIntegerIdentity);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, nestedValue] of Object.entries(value)) {
      expect(forbiddenIntegerIdentityKeys).not.toContain(key);
      expectNoIntegerIdentity(nestedValue);
    }
  };

  describe('argument round-trip', () => {
    test.each(tools)('$name forwards stable GUID arguments verbatim', async ({ name, args }) => {
      const captured = await captureCall(name, args);
      expect(captured.params).toEqual({ name, arguments: args });
      expect(captured.params.arguments.handoverGuid).toBe(HANDOVER_GUID);
      expectNoIntegerIdentity(captured.params.arguments);
    });

    test('conversion preserves both the opaque token and retry-stable idempotency key', async () => {
      const captured = await captureCall(
        'UteamupShiftHandoverConvertCarryOverToWorkOrder',
        convertArgs,
      );
      expect(captured.params.arguments.concurrencyToken).toBe(UPDATED_TOKEN);
      expect(captured.params.arguments.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    });
  });

  describe('success responses', () => {
    test('get returns GUID-only carry-over identities and the latest handover token', async () => {
      const response = await call(
        'UteamupShiftHandoverGetCarryOvers',
        getArgs,
        successReply([carryOver]),
      );
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result[0].guid).toBe(CARRY_OVER_GUID);
      expect(result[0].shiftHandoverGuid).toBe(HANDOVER_GUID);
      expect(result[0].handoverConcurrencyToken).toBe(UPDATED_TOKEN);
      expectNoIntegerIdentity(result);
    });

    test('get preserves an empty carry-over collection', async () => {
      const response = await call(
        'UteamupShiftHandoverGetCarryOvers',
        getArgs,
        successReply([]),
      );
      expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
    });

    test.each([
      ['UteamupShiftHandoverCreateCarryOver', createArgs, CREATED_TOKEN],
      ['UteamupShiftHandoverUpdateCarryOver', updateArgs, UPDATED_TOKEN],
    ])('%s returns a GUID-only item and refreshed token', async (name, args, token) => {
      const response = await call(
        name,
        args,
        successReply({ ...carryOver, handoverConcurrencyToken: token }),
      );
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.guid).toBe(CARRY_OVER_GUID);
      expect(result.handoverConcurrencyToken).toBe(token);
      expectNoIntegerIdentity(result);
    });

    test('delete returns only the carry-over GUID and refreshed handover token', async () => {
      const receipt = {
        carryOverGuid: CARRY_OVER_GUID,
        handoverConcurrencyToken: UPDATED_TOKEN,
      };
      const response = await call(
        'UteamupShiftHandoverDeleteCarryOver',
        deleteArgs,
        successReply(receipt),
      );
      expect(JSON.parse(response.body.result.content[0].text)).toEqual(receipt);
      expectNoIntegerIdentity(receipt);
    });

    test('conversion returns immutable workorder provenance and replay receipt', async () => {
      const converted = {
        ...carryOver,
        status: 'convertedToWorkOrder',
        workOrderGuid: WORKORDER_GUID,
        mutationReceiptGuid: '55555555-5555-4555-8555-555555555555',
        idempotencyReplay: false,
      };
      const response = await call(
        'UteamupShiftHandoverConvertCarryOverToWorkOrder',
        convertArgs,
        successReply(converted),
      );
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.workOrderGuid).toBe(WORKORDER_GUID);
      expect(result.mutationReceiptGuid).toBeDefined();
      expect(result.idempotencyReplay).toBe(false);
      expectNoIntegerIdentity(result);
    });
  });

  describe('error pass-through', () => {
    test.each(tools)('$name preserves backend JSON-RPC errors', async ({ name, args }) => {
      const response = await call(
        name,
        args,
        errorReply(-32602, 'Shift handover carry-over validation failed'),
      );
      expect(response.body.error).toEqual({
        code: -32602,
        message: 'Shift handover carry-over validation failed',
      });
    });

    test('conversion preserves stale-concurrency conflict details', async () => {
      const response = await call(
        'UteamupShiftHandoverConvertCarryOverToWorkOrder',
        convertArgs,
        errorReply(-32009, 'The shift handover changed. Refresh and retry.'),
      );
      expect(response.body.error.code).toBe(-32009);
      expect(response.body.error.message).toContain('Refresh and retry');
    });
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
