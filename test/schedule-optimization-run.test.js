'use strict';

const nock = require('nock');
const {
  callMcpTool,
  successReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('durable schedule optimization run MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_schedule_optimization';
  const runGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const tenantGuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const dispatcherGuid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const idempotencyKey = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const teamGuid = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const workorderGuid = '11111111-1111-4111-8111-111111111111';
  const technicianGuid = '22222222-2222-4222-8222-222222222222';
  const applyIdempotencyKey = '99999999-9999-4999-8999-999999999999';
  const revertIdempotencyKey = '88888888-8888-4888-8888-888888888888';
  const assignmentGuid = '33333333-3333-4333-8333-333333333333';

  const createArguments = {
    idempotencyKey,
    teamGuid,
    weekStart: '2026-07-13T00:00:00Z',
    workorderGuids: [workorderGuid],
    technicianGuids: [technicianGuid],
  };

  const responseModel = {
    runGuid,
    tenantGuid,
    requestedByGuid: dispatcherGuid,
    idempotencyKey,
    inputHash: 'sha256-input-hash',
    status: 2,
    progressPercent: 100,
    cancellationRequested: false,
    cancellationReason: null,
    retryCount: 0,
    request: createArguments,
    result: {
      proposedAssignments: [{
        workorderGuid,
        workorderUpdatedAt: '2026-07-15T08:00:00Z',
        crewRole: 'Technician',
        crewPosition: 1,
        crewSize: 1,
        technicianGuid,
        technicianName: 'Field technician',
        scheduledStart: '2026-07-15T09:00:00Z',
        scheduledEnd: '2026-07-15T10:00:00Z',
        competencyScore: 90,
        travelTimeMinutes: 12,
        scoreBreakdown: {
          competencyReward: 90,
          travelPenalty: 2.4,
          latenessPenalty: 0,
          workloadBalancePenalty: 0,
          totalScore: 87.6,
        },
        reasons: [
          'Competency score 90.0.',
          'No blocking qualification gaps.',
        ],
      }],
      unassignedWorkorders: [],
      totalTravelTimeMinutes: 12,
      averageCompetencyScore: 90,
      assignedCount: 1,
      unassignedCount: 0,
      solverMethod: 'DeterministicFastAssign',
    },
    isApplied: false,
    applyIdempotencyKey: null,
    appliedAt: null,
    appliedByGuid: null,
    appliedAssignmentGuids: [],
    isReverted: false,
    revertIdempotencyKey: null,
    revertReason: null,
    revertedAt: null,
    revertedByGuid: null,
    createdAt: '2026-07-15T08:00:00Z',
    updatedAt: '2026-07-15T08:01:00Z',
  };

  const applyArguments = {
    runGuid,
    idempotencyKey: applyIdempotencyKey,
    selectedWorkorderGuids: [workorderGuid],
  };

  const revertArguments = {
    runGuid,
    idempotencyKey: revertIdempotencyKey,
    reason: 'Restore prior dispatch plan',
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  async function call(toolName, args, data) {
    const response = await callMcpTool(
      BASE_URL,
      ACCESS_TOKEN,
      toolName,
      args,
      successReply(data),
    );

    expect(response.status).toBe(200);
    return JSON.parse(response.body.result.content[0].text);
  }

  it.each([
    ['UteamupScheduleOptimizationRunCreate', createArguments, responseModel],
    ['UteamupScheduleOptimizationRunGet', { runGuid }, responseModel],
    [
      'UteamupScheduleOptimizationRunCancel',
      { runGuid, reason: 'Priorities changed' },
      {
        ...responseModel,
        status: 4,
        cancellationRequested: true,
        cancellationReason: 'Priorities changed',
      },
    ],
    [
      'UteamupScheduleOptimizationRunApply',
      applyArguments,
      {
        ...responseModel,
        isApplied: true,
        applyIdempotencyKey,
        appliedAt: '2026-07-15T08:02:00Z',
        appliedByGuid: dispatcherGuid,
        appliedAssignmentGuids: [assignmentGuid],
      },
    ],
    [
      'UteamupScheduleOptimizationRunRevert',
      revertArguments,
      {
        ...responseModel,
        isReverted: true,
        revertIdempotencyKey,
        revertReason: 'Restore prior dispatch plan',
        revertedAt: '2026-07-15T08:03:00Z',
        revertedByGuid: dispatcherGuid,
      },
    ],
  ])('%s preserves the GUID-only durable contract', async (toolName, args, data) => {
    const result = await call(toolName, args, data);

    expect(result).toEqual(data);
    expect(JSON.stringify(args)).not.toMatch(
      /"(?:runId|teamId|workorderIds|technicianIds|selectedWorkorderIds)"/,
    );
    expect(JSON.stringify(result)).not.toMatch(
      /"(?:runId|tenantId|requestedById|workorderId|technicianId)"/,
    );
  });

  const errorTools = [
    { name: 'UteamupScheduleOptimizationRunCreate', args: createArguments },
    { name: 'UteamupScheduleOptimizationRunGet', args: { runGuid } },
    { name: 'UteamupScheduleOptimizationRunCancel', args: { runGuid } },
    { name: 'UteamupScheduleOptimizationRunApply', args: applyArguments },
    { name: 'UteamupScheduleOptimizationRunRevert', args: revertArguments },
  ];

  describeJsonRpcCompliance(call, errorTools);
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
