'use strict';

const nock = require('nock');
const {
  callMcpTool,
  successReply,
  errorReply
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
} = require('./helpers/mcp-error-tests');

describe('versioned schedule publication MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_schedule_publication';
  const draftGuid = '11111111-1111-4111-8111-111111111111';
  const entryGuid = '22222222-2222-4222-8222-222222222222';
  const workerGuid = '33333333-3333-4333-8333-333333333333';
  const shiftGuid = '44444444-4444-4444-8444-444444444444';
  const projectGuid = '55555555-5555-4555-8555-555555555555';
  const workorderGuid = '66666666-6666-4666-8666-666666666666';
  const publicationGuid = '77777777-7777-4777-8777-777777777777';
  const newerPublicationGuid = '88888888-8888-4888-8888-888888888888';
  const weekStart = '2026-07-20T00:00:00';
  const startUtc = '2026-07-20T08:00:00Z';
  const endUtc = '2026-07-20T16:00:00Z';
  const workers = [{ workerGuid, allocationPercent: 75 }];
  const entryArgs = {
    draftGuid,
    kind: 'shift',
    startUtc,
    endUtc,
    workers,
    shiftGuid,
    allocationPercent: 75,
    isOpenShift: false,
    notes: 'Primary electrical coverage'
  };

  const tools = [
    { name: 'UteamupScheduleDraftList', args: { weekStart } },
    { name: 'UteamupScheduleDraftGet', args: { draftGuid } },
    {
      name: 'UteamupScheduleDraftCreate',
      args: { weekStart, basePublicationGuid: publicationGuid }
    },
    { name: 'UteamupScheduleDraftEntryAdd', args: entryArgs },
    {
      name: 'UteamupScheduleDraftEntryUpdate',
      args: { ...entryArgs, entryGuid, expectedRowVersion: 7 }
    },
    {
      name: 'UteamupScheduleDraftEntryDelete',
      args: { draftGuid, entryGuid, expectedRowVersion: 8 }
    },
    { name: 'UteamupScheduleDraftDiscard', args: { draftGuid, expectedRowVersion: 9, reason: 'Superseded plan' } },
    { name: 'UteamupScheduleDraftValidate', args: { draftGuid } },
    {
      name: 'UteamupScheduleDraftPublish',
      args: {
        draftGuid,
        expectedRowVersion: 10,
        acknowledgedWarningCodes: ['weekly_hours_warning'],
        overrideReason: 'Approved seasonal coverage'
      }
    },
    { name: 'UteamupSchedulePublicationGet', args: { publicationGuid } },
    { name: 'UteamupSchedulePublicationHistory', args: { weekStart } },
    {
      name: 'UteamupSchedulePublicationDiff',
      args: {
        fromPublicationGuid: publicationGuid,
        toPublicationGuid: newerPublicationGuid
      }
    },
    {
      name: 'UteamupSchedulePublicationRecall',
      args: { publicationGuid, reason: 'Site closure' }
    },
    {
      name: 'UteamupSchedulePublicationRollback',
      args: { publicationGuid, reason: 'Restore approved staffing' }
    },
    {
      name: 'UteamupWorkforceAvailabilityCheck',
      args: { workerGuid, fromUtc: startUtc, toUtc: endUtc }
    },
    {
      name: 'UteamupWorkforceReservationReadiness',
      args: {
        workerGuid,
        projectGuid,
        start: startUtc,
        end: endUtc,
        allocationPercent: 25,
        workorderGuid
      }
    },
    {
      name: 'UteamupWorkforceReservationCreate',
      args: {
        workerGuid,
        projectGuid,
        start: startUtc,
        end: endUtc,
        allocationPercent: 25,
        workorderGuid,
        handoffNotes: 'Coordinate with the shift lead'
      }
    }
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (name, args, reply, expectedArgs) => callMcpTool(
    BASE_URL,
    ACCESS_TOKEN,
    name,
    args,
    reply,
    expectedArgs
  );

  test.each(tools)('$name round-trips GUID-first arguments', async ({ name, args }) => {
    const expected = { tool: name, accepted: true };
    const response = await call(name, args, successReply(expected), args);

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(expected);
    expect(JSON.stringify(args)).not.toMatch(
      /"(?:tenantId|userId|draftId|entryId|publicationId|projectId|workorderId)"/
    );
  });

  test('draft list preserves an empty result', async () => {
    const response = await call(
      'UteamupScheduleDraftList',
      { weekStart },
      successReply([]),
      { weekStart }
    );

    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });

  test('publish forwards concurrency, warning acknowledgements, and reason unchanged', async () => {
    const publish = tools.find(tool => tool.name === 'UteamupScheduleDraftPublish');
    const response = await call(
      publish.name,
      publish.args,
      successReply({
        publication: { externalGuid: publicationGuid, version: 2 },
        overriddenWarningCodes: ['weekly_hours_warning'],
        auditReceiptGuid: '99999999-9999-4999-8999-999999999999'
      }),
      publish.args
    );

    const body = JSON.parse(response.body.result.content[0].text);
    expect(body.publication.version).toBe(2);
    expect(body.overriddenWarningCodes).toEqual(['weekly_hours_warning']);
    expect(body.auditReceiptGuid).toBeDefined();
  });

  test('backend validation errors preserve JSON-RPC error shape', async () => {
    const response = await call(
      'UteamupScheduleDraftPublish',
      tools.find(tool => tool.name === 'UteamupScheduleDraftPublish').args,
      errorReply(-32602, 'schedule_concurrency_conflict')
    );

    expect(response.status).toBe(200);
    expect(response.body.error).toEqual({
      code: -32602,
      message: 'schedule_concurrency_conflict'
    });
    expect(response.body.result).toBeUndefined();
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
