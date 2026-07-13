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

describe('Shift-handover Operational Baton MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'shift_handover_operational_baton_token';
  const HANDOVER_GUID = '11111111-1111-4111-8111-111111111111';
  const args = { handoverGuid: HANDOVER_GUID };
  const tools = [{ name: 'UteamupShiftHandoverGetOperationalBaton', args }];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  test('returns the deterministic action-first baton without integer identities', async () => {
    const baton = {
      shiftHandoverGuid: HANDOVER_GUID,
      sourceUpdatedAtUtc: '2026-07-13T08:00:00Z',
      status: 'Reviewed',
      outgoingOperatorName: 'Outgoing operator',
      incomingOperatorName: 'Incoming operator',
      unresolvedCriticalItemCount: 1,
      incompleteRequiredSectionCount: 0,
      isIncomingAcknowledgmentComplete: false,
      assetSnapshotState: 'Unavailable',
      safetyItems: [],
      blockerItems: [],
      activeWorkItems: [],
      assetStateItems: [],
      fleetAssets: [],
      carryOverItems: [],
      incomingActionItems: [
        {
          itemGuid: '22222222-2222-4222-8222-222222222222',
          itemKind: 'CarryOver',
          title: 'Inspect pump seal',
          isCritical: true,
          isAcknowledged: false,
          links: [],
        },
      ],
    };

    const response = await call(
      'UteamupShiftHandoverGetOperationalBaton',
      args,
      successReply(baton),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result).toEqual(baton);
    expect(result.incomingActionItems[0].title).toBe('Inspect pump seal');
    expect(JSON.stringify(result)).not.toMatch(/tenantId|handoverId|shiftHandoverId|assetId/);
  });

  test('preserves legitimate empty operational categories and explicit asset state', async () => {
    const response = await call(
      'UteamupShiftHandoverGetOperationalBaton',
      args,
      successReply({
        shiftHandoverGuid: HANDOVER_GUID,
        assetSnapshotState: 'Unavailable',
        safetyItems: [],
        blockerItems: [],
        activeWorkItems: [],
        assetStateItems: [],
        fleetAssets: [],
        carryOverItems: [],
        incomingActionItems: [],
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.incomingActionItems).toEqual([]);
    expect(result.assetSnapshotState).toBe('Unavailable');
  });

  test('forwards only the stable handover GUID verbatim', async () => {
    let captured = null;
    nock(BASE_URL)
      .post('/mcp', body => {
        captured = body;
        return body.params?.name === 'UteamupShiftHandoverGetOperationalBaton';
      })
      .reply(200, JSON.stringify(successReply({ shiftHandoverGuid: HANDOVER_GUID }).body), {
        'Content-Type': 'application/json',
      });

    await sendRawRequest(
      BASE_URL,
      'UteamupShiftHandoverGetOperationalBaton',
      args,
    );

    expect(captured.params).toEqual({
      name: 'UteamupShiftHandoverGetOperationalBaton',
      arguments: args,
    });
    expect(JSON.stringify(captured)).not.toMatch(/handoverId|userId|tenantId/);
  });

  test('preserves not-found errors from the backend', async () => {
    const response = await call(
      'UteamupShiftHandoverGetOperationalBaton',
      args,
      errorReply(-32004, 'Shift handover not found.'),
    );

    expect(response.body.error.code).toBe(-32004);
    expect(response.body.error.message).toBe('Shift handover not found.');
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
