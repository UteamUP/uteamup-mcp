'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('schedule emergency insertion MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_schedule_emergency';
  const workorderGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const technicianGuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const teamGuid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const assignmentGuid = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  const args = {
    workorderGuid,
    desiredStartUtc: '2026-07-16T10:00:00Z',
    planningWindowEndUtc: '2026-07-16T18:00:00Z',
    teamGuid,
    technicianGuids: [technicianGuid],
    maxDisplacedAssignments: 3,
  };

  const proposal = {
    workorderGuid,
    workorderName: 'Burst pipe',
    hasEligibleProposal: true,
    bestTechnicianGuid: technicianGuid,
    bestTechnicianName: 'Ada Lovelace',
    proposedStartUtc: '2026-07-16T10:00:00Z',
    proposedEndUtc: '2026-07-16T12:00:00Z',
    displacedAssignmentCount: 1,
    totalDisplacedMinutes: 90,
    totalTravelIncreaseMinutes: 12,
    competencyScore: 95,
    scoreBreakdown: {
      competencyReward: 95,
      disruptionPenalty: 25,
      travelPenalty: 2.4,
      totalScore: 67.6,
    },
    affectedAssignments: [
      {
        assignmentGuid,
        workorderGuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        workorderName: 'Routine inspection',
        currentStartUtc: '2026-07-16T11:00:00Z',
        currentEndUtc: '2026-07-16T12:00:00Z',
        proposedStartUtc: '2026-07-16T12:00:00Z',
        proposedEndUtc: '2026-07-16T13:00:00Z',
        assignmentUpdatedAtUtc: '2026-07-15T09:00:00Z',
        changeReason: 'Moved after the emergency work while preserving its existing duration.',
      },
    ],
    reasons: [
      '1 scheduled assignment(s) move by 90 minutes in total.',
      'The technician has a competency score of 95.0 for this workorder.',
    ],
    blockingConstraints: [],
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  async function call(toolName, toolArgs, data) {
    const result = await callMcpTool(
      BASE_URL,
      ACCESS_TOKEN,
      toolName,
      toolArgs,
      successReply(data),
    );
    expect(result.status).toBe(200);
    return JSON.parse(result.body.result.content[0].text);
  }

  test('returns a read-only GUID-first emergency insertion proposal', async () => {
    const result = await call(
      'UteamupScheduleEmergencyInsertionPreview',
      args,
      proposal,
    );

    expect(result).toEqual(proposal);
    expect(JSON.stringify(args)).not.toMatch(/"(?:workorderId|teamId|technicianIds)"/);
    expect(JSON.stringify(result)).not.toMatch(/"(?:workorderId|assignmentId|technicianId)"/);
    expect(result.hasEligibleProposal).toBe(true);
    expect(result.affectedAssignments[0].assignmentGuid).toBe(assignmentGuid);
  });

  test('returns explicit blocking constraints when no insertion is eligible', async () => {
    const noProposal = {
      ...proposal,
      hasEligibleProposal: false,
      bestTechnicianGuid: null,
      bestTechnicianName: '',
      displacedAssignmentCount: 0,
      totalDisplacedMinutes: 0,
      totalTravelIncreaseMinutes: 0,
      competencyScore: 0,
      affectedAssignments: [],
      reasons: [],
      blockingConstraints: ['No eligible emergency insertion could be calculated.'],
    };

    const result = await call(
      'UteamupScheduleEmergencyInsertionPreview',
      args,
      noProposal,
    );

    expect(result.hasEligibleProposal).toBe(false);
    expect(result.blockingConstraints).toContain(
      'No eligible emergency insertion could be calculated.',
    );
  });

  test('handles backend JSON-RPC errors without crashing the proxy', async () => {
    const result = await callMcpTool(
      BASE_URL,
      ACCESS_TOKEN,
      'UteamupScheduleEmergencyInsertionPreview',
      args,
      errorReply(-32603, 'Permission denied: Schedule.Optimize required.'),
    );

    expect(result.status).toBe(200);
    expect(result.body.error.message).toContain('Schedule.Optimize');
  });

  const tools = [{ name: 'UteamupScheduleEmergencyInsertionPreview', args }];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
