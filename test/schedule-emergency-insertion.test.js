'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('emergency schedule insertion preview MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_emergency_insertion';
  const args = {
    workorderGuid: '11111111-1111-4111-8111-111111111111',
    desiredStartUtc: '2026-07-20T08:00:00Z',
    planningWindowEndUtc: '2026-07-20T18:00:00Z',
    teamGuid: '22222222-2222-4222-8222-222222222222',
    technicianGuids: ['33333333-3333-4333-8333-333333333333'],
    maxDisplacedAssignments: 3,
  };
  const response = {
    workorderGuid: args.workorderGuid,
    workorderName: 'Emergency repair',
    hasEligibleProposal: true,
    bestTechnicianGuid: args.technicianGuids[0],
    bestTechnicianName: 'Ada Technician',
    proposedStartUtc: args.desiredStartUtc,
    proposedEndUtc: '2026-07-20T09:00:00Z',
    displacedAssignmentCount: 1,
    totalDisplacedMinutes: 60,
    totalTravelIncreaseMinutes: 8,
    competencyScore: 90,
    scoreBreakdown: {
      competencyReward: 90,
      disruptionPenalty: 28,
      travelPenalty: 1.6,
      totalScore: 60.4,
    },
    affectedAssignments: [{
      assignmentGuid: '44444444-4444-4444-8444-444444444444',
      workorderGuid: '55555555-5555-4555-8555-555555555555',
      workorderName: 'Planned inspection',
      currentStartUtc: '2026-07-20T08:30:00Z',
      currentEndUtc: '2026-07-20T09:30:00Z',
      proposedStartUtc: '2026-07-20T09:00:00Z',
      proposedEndUtc: '2026-07-20T10:00:00Z',
      assignmentUpdatedAtUtc: '2026-07-19T12:00:00Z',
      changeReason: 'Moved after the emergency work.',
    }],
    reasons: ['Least disruption'],
    blockingConstraints: [],
  };
  const tool = {
    name: 'UteamupScheduleEmergencyInsertionPreview',
    args,
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

  it('preserves the deterministic GUID-only displacement evidence', async () => {
    expect(await call(tool.name, tool.args, response)).toEqual(response);
    expect(JSON.stringify(args)).not.toMatch(
      /"(?:workorderId|teamId|technicianIds|maxDisplacedAssignmentIds)"/,
    );
    expect(JSON.stringify(response)).not.toMatch(
      /"(?:assignmentId|affectedAssignmentIds|bestTechnicianId)"/,
    );
  });

  describeJsonRpcCompliance(call, [tool]);
  describe401Unauthorized(BASE_URL, [tool]);
  describe503ServiceUnavailable(BASE_URL, [tool]);
});
