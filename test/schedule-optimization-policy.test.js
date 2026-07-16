'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('recurring schedule optimization policy MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_schedule_policy';
  const policyGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const mutation = {
    idempotencyKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    name: 'Daily schedule review',
    teamGuids: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
    frequency: 0,
    timeZoneId: 'Atlantic/Reykjavik',
    daysOfWeekMask: 62,
    localExecutionTime: '06:00',
    horizonDays: 7,
    isEnabled: true,
  };
  const response = {
    policyGuid,
    tenantGuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    ...mutation,
    objectiveWeights: {
      competency: 1,
      travel: 1,
      lateness: 1,
      overtime: 1,
      workloadBalance: 1,
      continuity: 1,
      repeatVisit: 1,
      disruption: 1,
    },
    nextRunAtUtc: '2026-07-16T06:00:00Z',
    lastOutcome: null,
    createdAt: '2026-07-15T06:00:00Z',
    updatedAt: '2026-07-15T06:00:00Z',
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  async function call(toolName, args, data) {
    const result = await callMcpTool(
      BASE_URL,
      ACCESS_TOKEN,
      toolName,
      args,
      successReply(data),
    );
    expect(result.status).toBe(200);
    return JSON.parse(result.body.result.content[0].text);
  }

  it.each([
    ['UteamupScheduleOptimizationPolicyList', {}, [response]],
    ['UteamupScheduleOptimizationPolicyGet', { policyGuid }, response],
    ['UteamupScheduleOptimizationPolicyCreate', mutation, response],
    ['UteamupScheduleOptimizationPolicyUpdate', { policyGuid, ...mutation }, response],
    [
      'UteamupScheduleOptimizationPolicyDelete',
      { policyGuid, idempotencyKey: mutation.idempotencyKey },
      true,
    ],
  ])('%s preserves GUID-only policy evidence', async (toolName, args, data) => {
    expect(await call(toolName, args, data)).toEqual(data);
    expect(JSON.stringify(args)).not.toMatch(/"(?:policyId|tenantId|teamIds)"/);
  });

  const errorTools = [
    { name: 'UteamupScheduleOptimizationPolicyList', args: {} },
    { name: 'UteamupScheduleOptimizationPolicyGet', args: { policyGuid } },
    { name: 'UteamupScheduleOptimizationPolicyCreate', args: mutation },
    { name: 'UteamupScheduleOptimizationPolicyUpdate', args: { policyGuid, ...mutation } },
    {
      name: 'UteamupScheduleOptimizationPolicyDelete',
      args: { policyGuid, idempotencyKey: mutation.idempotencyKey },
    },
  ];
  describeJsonRpcCompliance(call, errorTools);
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
