'use strict';

const nock = require('nock');
const {
  callMcpTool: callMcpToolRequest,
  successReply,
  errorReply
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
} = require('./helpers/mcp-error-tests');

describe('Concurrent time-entry timer MCP contracts', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_time_entries';
  const TIMER_GUID = '11111111-1111-4111-8111-111111111111';
  const WORKORDER_GUID = '22222222-2222-4222-8222-222222222222';
  const IDEMPOTENCY_GUID = '33333333-3333-4333-8333-333333333333';
  const UPDATED_AT = '2026-08-24T12:00:00Z';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    callMcpToolRequest(
      BASE_URL,
      ACCESS_TOKEN,
      toolName,
      toolArgs,
      mockReply,
      expectedArgs
    );

  test('forwards RunAlongside and the atomic workorder transition', async () => {
    const args = {
      idempotencyKey: IDEMPOTENCY_GUID,
      workorderGuid: WORKORDER_GUID,
      startMode: 'RunAlongside',
      transitionWorkorderToInProgress: true
    };
    const response = await call(
      'UteamupTimeEntryStartTimer',
      args,
      successReply({ externalGuid: TIMER_GUID, timerState: 'Running' }),
      args
    );

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text).externalGuid)
      .toBe(TIMER_GUID);
  });

  test('returns every open timer with the server clock', async () => {
    const response = await call(
      'UteamupTimeEntryGetActiveTimers',
      {},
      successReply({
        serverTimeUtc: UPDATED_AT,
        items: [
          { externalGuid: TIMER_GUID, timerState: 'Running' },
          { externalGuid: WORKORDER_GUID, timerState: 'Paused' }
        ]
      })
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.serverTimeUtc).toBe(UPDATED_AT);
    expect(data.items).toHaveLength(2);
  });

  test('preserves an empty active-timer list', async () => {
    const response = await call(
      'UteamupTimeEntryGetActiveTimers',
      {},
      successReply({ serverTimeUtc: UPDATED_AT, items: [] })
    );

    expect(JSON.parse(response.body.result.content[0].text).items).toEqual([]);
  });

  test('surfaces stable timer conflicts', async () => {
    const response = await call(
      'UteamupTimeEntryResumeTimer',
      {
        timeEntryGuid: TIMER_GUID,
        expectedUpdatedAt: UPDATED_AT,
        idempotencyKey: IDEMPOTENCY_GUID,
        startMode: 'RejectIfAnyActive'
      },
      errorReply(-32009, 'timer_already_open_for_workorder')
    );

    expect(response.body.error.message)
      .toContain('timer_already_open_for_workorder');
  });

  const tools = [
    { name: 'UteamupTimeEntryGetActiveTimers', args: {} },
    {
      name: 'UteamupTimeEntryStartTimer',
      args: {
        idempotencyKey: IDEMPOTENCY_GUID,
        workorderGuid: WORKORDER_GUID,
        startMode: 'PauseOthers',
        transitionWorkorderToInProgress: true
      }
    },
    {
      name: 'UteamupTimeEntryPauseTimer',
      args: {
        timeEntryGuid: TIMER_GUID,
        expectedUpdatedAt: UPDATED_AT,
        idempotencyKey: IDEMPOTENCY_GUID
      }
    },
    {
      name: 'UteamupTimeEntryResumeTimer',
      args: {
        timeEntryGuid: TIMER_GUID,
        expectedUpdatedAt: UPDATED_AT,
        idempotencyKey: IDEMPOTENCY_GUID,
        startMode: 'RunAlongside'
      }
    }
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
