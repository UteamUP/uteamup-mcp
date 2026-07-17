/** GUID-only service SLA milestone MCP proxy contracts. */

'use strict';

const nock = require('nock');
const {
  callMcpTool: callTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('service SLA milestone MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_service_sla';
  const milestoneGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const workorderGuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const agreementGuid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const customerGuid = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const coverageGuid = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const idempotencyKey = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const asOf = '2026-07-16T12:00:00Z';
  const updatedAt = '2026-07-16T10:00:00Z';

  const responseModel = {
    externalGuid: milestoneGuid,
    workorderGuid,
    workorderName: 'Compressor response',
    workorderTicketId: 'WO-1042',
    agreementGuid,
    agreementTitle: 'Solid Energy priority support',
    customerGuid,
    customerName: 'Solid Energy',
    coverageGuid,
    milestoneType: 'response',
    status: 'warning',
    targetMinutes: 120,
    warningPercentage: 75,
    targetSource: 'agreement.coverage.responseMinutes',
    pauseOutsideBusinessHours: true,
    startedAt: '2026-07-16T09:00:00Z',
    warningDueAt: '2026-07-16T10:30:00Z',
    dueAt: '2026-07-16T11:00:00Z',
    warningRecordedAt: '2026-07-16T10:30:00Z',
    breachedAt: null,
    pausedAt: null,
    totalPausedMinutes: 0,
    completedAt: null,
    cancelledAt: null,
    lastEvaluatedAt: asOf,
    pauseReason: null,
    completionNote: null,
    deltaMinutes: -60,
    remainingMinutes: 0,
    createdAt: '2026-07-16T09:00:00Z',
    updatedAt,
  };
  const listResponse = {
    items: [responseModel],
    totalCount: 1,
    page: 1,
    pageSize: 50,
    asOf,
  };
  const transitionModel = {
    idempotencyKey,
    expectedUpdatedAt: updatedAt,
    occurredAt: asOf,
    reason: 'Reviewed operational transition',
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, args, reply) =>
    callTool(BASE_URL, ACCESS_TOKEN, toolName, args, reply, args);

  test.each([
    [
      'UteamupServiceSlaMilestoneList',
      { workorderGuid, agreementGuid, status: 'warning', asOf, page: 1, pageSize: 50 },
      listResponse,
    ],
    ['UteamupServiceSlaMilestoneGet', { milestoneGuid, asOf }, responseModel],
    [
      'UteamupServiceSlaMilestoneInitialize',
      { workorderGuid, model: { idempotencyKey, startedAt: responseModel.startedAt } },
      [responseModel],
    ],
    ['UteamupServiceSlaMilestonePause', { milestoneGuid, model: transitionModel }, responseModel],
    ['UteamupServiceSlaMilestoneResume', { milestoneGuid, model: transitionModel }, responseModel],
    ['UteamupServiceSlaMilestoneComplete', { milestoneGuid, model: transitionModel }, responseModel],
    ['UteamupServiceSlaMilestoneCancel', { milestoneGuid, model: transitionModel }, responseModel],
    [
      'UteamupServiceSlaMilestoneReconcile',
      { model: { idempotencyKey, workorderGuid, asOf } },
      [responseModel],
    ],
  ])('%s forwards reviewed GUID-safe evidence', async (toolName, args, data) => {
    const result = await call(toolName, args, successReply(data));
    expect(result.status).toBe(200);
    const parsed = JSON.parse(result.body.result.content[0].text);
    expect(parsed).toEqual(data);
    expect(JSON.stringify(parsed)).not.toMatch(
      /"(?:id|tenantId|workorderId|agreementId|customerId|coverageId|milestoneId|userId)"/,
    );
    expect(args).not.toHaveProperty('tenantGuid');
    expect(args).not.toHaveProperty('userGuid');
  });

  test('preserves an empty paginated result without fabricating milestones', async () => {
    const args = { page: 1, pageSize: 50, asOf };
    const empty = { items: [], totalCount: 0, page: 1, pageSize: 50, asOf };
    const result = await call(
      'UteamupServiceSlaMilestoneList',
      args,
      successReply(empty),
    );

    expect(JSON.parse(result.body.result.content[0].text)).toEqual(empty);
  });

  test('preserves backend JSON-RPC errors', async () => {
    const result = await call(
      'UteamupServiceSlaMilestoneGet',
      { milestoneGuid },
      errorReply(-32603, 'SLA milestone unavailable'),
    );
    expect(result.body.error.code).toBe(-32603);
  });

  const tools = [
    { name: 'UteamupServiceSlaMilestoneList', args: { page: 1, pageSize: 50 } },
    { name: 'UteamupServiceSlaMilestoneGet', args: { milestoneGuid } },
    {
      name: 'UteamupServiceSlaMilestoneInitialize',
      args: { workorderGuid, model: { idempotencyKey } },
    },
    { name: 'UteamupServiceSlaMilestonePause', args: { milestoneGuid, model: transitionModel } },
    { name: 'UteamupServiceSlaMilestoneResume', args: { milestoneGuid, model: transitionModel } },
    { name: 'UteamupServiceSlaMilestoneComplete', args: { milestoneGuid, model: transitionModel } },
    { name: 'UteamupServiceSlaMilestoneCancel', args: { milestoneGuid, model: transitionModel } },
    {
      name: 'UteamupServiceSlaMilestoneReconcile',
      args: { model: { idempotencyKey, workorderGuid, asOf } },
    },
  ];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
