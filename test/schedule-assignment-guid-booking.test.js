'use strict';

const nock = require('nock');
const { sendRawRequest, successReply } = require('./helpers/mcp-test-helpers');

describe('GUID schedule booking MCP contracts', () => {
  const BASE_URL = 'https://api.test.com';
  const ASSIGNMENT_GUID = '11111111-1111-4111-8111-111111111111';
  const TEAM_GUID = '22222222-2222-4222-8222-222222222222';
  const TECHNICIAN_GUID = '33333333-3333-4333-8333-333333333333';
  const START = '2026-07-15T08:00:00Z';
  const END = '2026-07-15T10:00:00Z';

  const tools = [
    {
      name: 'UteamupScheduleAssignmentGetWeekByGuid',
      args: { weekStart: START, teamGuid: TEAM_GUID },
    },
    {
      name: 'UteamupScheduleAssignmentMoveByGuid',
      args: {
        assignmentGuid: ASSIGNMENT_GUID,
        newScheduledStart: START,
        newScheduledEnd: END,
        newTechnicianGuid: TECHNICIAN_GUID,
      },
    },
    {
      name: 'UteamupScheduleAssignmentUpdateStatusByGuid',
      args: { assignmentGuid: ASSIGNMENT_GUID, status: 'Completed' },
    },
    {
      name: 'UteamupScheduleAssignmentCancelByGuid',
      args: { assignmentGuid: ASSIGNMENT_GUID },
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test.each(tools)('$name forwards the exact GUID-only JSON-RPC contract', async ({ name, args }) => {
    let captured;
    nock(BASE_URL)
      .post('/mcp', body => {
        captured = body;
        return true;
      })
      .reply(200, JSON.stringify(successReply({ accepted: true }).body), {
        'Content-Type': 'application/json',
      });

    const status = await sendRawRequest(BASE_URL, name, args, 710);

    expect(status).toBe(200);
    expect(captured).toEqual({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name, arguments: args },
      id: 710,
    });
    expect(Object.keys(args)).not.toEqual(expect.arrayContaining([
      'id',
      'teamId',
      'technicianId',
      'assignmentId',
    ]));
  });
});
