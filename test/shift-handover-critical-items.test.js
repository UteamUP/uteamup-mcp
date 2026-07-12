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

describe('Shift-handover critical-item MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'critical_item_token';
  const HANDOVER_GUID = '11111111-1111-4111-8111-111111111111';
  const SECTION_GUID = '22222222-2222-4222-8222-222222222222';
  const CARRY_OVER_GUID = '33333333-3333-4333-8333-333333333333';
  const model = { notes: 'Reviewed response plan', concurrencyToken: 'current-token' };
  const tools = [
    {
      name: 'UteamupShiftHandoverAcknowledgeCriticalSection',
      args: { handoverGuid: HANDOVER_GUID, sectionGuid: SECTION_GUID, model },
    },
    {
      name: 'UteamupShiftHandoverAcknowledgeCriticalCarryOver',
      args: { handoverGuid: HANDOVER_GUID, carryOverGuid: CARRY_OVER_GUID, model },
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  test.each(tools)('$name forwards GUIDs, notes, and concurrency token verbatim', async ({ name, args }) => {
    let captured = null;
    nock(BASE_URL)
      .post('/mcp', body => {
        captured = body;
        return body.params?.name === name;
      })
      .reply(200, JSON.stringify(successReply({}).body), {
        'Content-Type': 'application/json',
      });

    await sendRawRequest(BASE_URL, name, args);

    expect(captured.params).toEqual({ name, arguments: args });
    expect(captured.params.arguments.handoverGuid).toBe(HANDOVER_GUID);
    expect(captured.params.arguments.model.concurrencyToken).toBe('current-token');
    expect(JSON.stringify(captured)).not.toMatch(/handoverId|sectionId|carryOverId/);
  });

  test('carry-over acknowledgement preserves unresolved state and refreshed token', async () => {
    const result = {
      itemKind: 'carryOver',
      itemGuid: CARRY_OVER_GUID,
      acknowledgedAtUtc: '2026-07-12T21:00:00Z',
      acknowledgedByUserGuid: '44444444-4444-4444-8444-444444444444',
      notes: model.notes,
      remainsUnresolved: true,
      handoverConcurrencyToken: 'next-token',
    };

    const response = await call(tools[1].name, tools[1].args, successReply(result));

    expect(JSON.parse(response.body.result.content[0].text)).toEqual(result);
  });

  test.each(tools)('$name preserves backend conflict details', async ({ name, args }) => {
    const response = await call(
      name,
      args,
      errorReply(-32009, 'Acknowledge every critical handover item before accepting.'),
    );

    expect(response.body.error.code).toBe(-32009);
    expect(response.body.error.message).toContain('critical handover item');
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
