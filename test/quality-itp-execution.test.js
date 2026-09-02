/** Governed, GUID-only inspection and test plan execution MCP generic-proxy contracts. */
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

describe('Quality inspection and test plan execution MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_quality_itp_execution';
  const PLAN_GUID = '11111111-1111-4111-8111-111111111111';
  const REVISION_GUID = '22222222-2222-4222-8222-222222222222';
  const EXECUTION_GUID = '33333333-3333-4333-8333-333333333333';
  const STEP_GUID = '44444444-4444-4444-8444-444444444444';
  const EVIDENCE_GUID = '55555555-5555-4555-8555-555555555555';
  const USER_GUID = '66666666-6666-4666-8666-666666666666';
  const IDEMPOTENCY_KEY = 'quality-itp-execution-opaque-retry-key-001';
  const CONCURRENCY_TOKEN = 'quality-itp-execution-token-v1';

  const tools = [
    {
      name: 'UteamupQualityItpExecutionSearch',
      args: { planGuid: PLAN_GUID, revisionGuid: REVISION_GUID, status: 'BlockedAtHold', releaseState: 'NotReady', page: 1, pageSize: 25 },
    },
    { name: 'UteamupQualityItpExecutionGet', args: { executionGuid: EXECUTION_GUID } },
    {
      name: 'UteamupQualityItpExecutionCreate',
      args: {
        request: {
          inspectionTestPlanGuid: PLAN_GUID,
          inspectionTestPlanRevisionGuid: REVISION_GUID,
          scheduledStartAtUtc: '2026-09-10T08:00:00Z',
          scheduledEndAtUtc: '2026-09-10T16:00:00Z',
          participants: [{ role: 'Inspector', internalUserGuid: USER_GUID }],
        },
        idempotencyKey: IDEMPOTENCY_KEY,
      },
    },
    {
      name: 'UteamupQualityItpExecutionTransition',
      args: {
        executionGuid: EXECUTION_GUID,
        actionKey: 'itp-execution.reach-hold',
        request: { reason: null, attestationText: null, holdStepGuid: STEP_GUID, evidenceGuids: [] },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
    {
      name: 'UteamupQualityItpExecutionResultUpsert',
      args: {
        executionGuid: EXECUTION_GUID,
        request: { inspectionTestPlanStepGuid: STEP_GUID, outcome: 'Passed', evidenceSummary: 'Certificates reviewed.', evidenceGuids: [] },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: CONCURRENCY_TOKEN,
      },
    },
    {
      name: 'UteamupQualityItpExecutionPointEventAdd',
      args: {
        executionGuid: EXECUTION_GUID,
        request: { inspectionTestPlanStepGuid: STEP_GUID, eventType: 'AttendanceConfirmed', reason: null },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: CONCURRENCY_TOKEN,
      },
    },
    {
      name: 'UteamupQualityItpExecutionEvidenceAdd',
      args: {
        executionGuid: EXECUTION_GUID,
        request: {
          evidence: {
            documentGuid: '77777777-7777-4777-8777-777777777777',
            documentVersionGuid: '88888888-8888-4888-8888-888888888888',
            purpose: 'Verification',
            captureSource: 'ExistingDocument',
            confidentialityClassification: 'Internal',
          },
          reason: 'Signed pressure test record.',
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: CONCURRENCY_TOKEN,
      },
    },
    {
      name: 'UteamupQualityItpExecutionEvidenceRevoke',
      args: {
        executionGuid: EXECUTION_GUID,
        evidenceGuid: EVIDENCE_GUID,
        request: { reason: 'Wrong document version was linked.' },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    callTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  test('execution reads carry the frozen steps, the hold state and the lifecycle availability', async () => {
    const response = await call(
      tools[1].name,
      tools[1].args,
      successReply({
        execution: {
          guid: EXECUTION_GUID, displayNumber: 'ITPE-2026-000001', status: 'BlockedAtHold',
          currentHoldStepGuid: STEP_GUID, concurrencyToken: CONCURRENCY_TOKEN, results: [],
        },
        evidence: [],
        transitionAvailability: {
          options: [{ actionKey: 'itp-execution.release-hold', toStatus: 'InProgress', isAvailable: false, blockedReasonCode: 'action_permission_required', blockedReason: 'Release needed.' }],
        },
      }),
      tools[1].args,
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.execution.currentHoldStepGuid).toBe(STEP_GUID);
    expect(data.transitionAvailability.options[0].isAvailable).toBe(false);
    expect(data.execution).not.toHaveProperty('id');
  });

  test('a confirmed execution transition returns the applied receipt', async () => {
    const confirmArgs = { ...tools[3].args, confirmed: true, previewToken: 'opaque-preview-token', concurrencyToken: CONCURRENCY_TOKEN };
    const response = await call(
      tools[3].name,
      confirmArgs,
      successReply({
        applied: true,
        concurrencyToken: 'quality-itp-execution-token-v2',
        strongETag: '"quality-itp-execution-token-v2"',
        consequencePreview: { operation: 'itp-execution.reach-hold', recordGuid: EXECUTION_GUID, canApply: true },
        execution: { execution: { guid: EXECUTION_GUID, status: 'BlockedAtHold', concurrencyToken: 'quality-itp-execution-token-v2' } },
      }),
      confirmArgs,
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.applied).toBe(true);
    expect(data.execution.execution.status).toBe('BlockedAtHold');
    expect(data.concurrencyToken).toBe('quality-itp-execution-token-v2');
  });

  test.each(tools)('$name forwards every argument verbatim', async ({ name, args }) => {
    const response = await call(name, args, successReply({ forwarded: true }), args);
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text).forwarded).toBe(true);
  });

  test.each(tools)('$name has no caller-controlled actor or tenant argument', ({ args }) => {
    ['tenantGuid', 'tenantId', 'actorGuid', 'userGuid', 'userId', 'apiKeyId', 'apiKeyPrefix', 'sourceChannel']
      .forEach(property => expect(args).not.toHaveProperty(property));
  });

  test('surfaces a stale concurrency token as an MCP error', async () => {
    const staleArgs = { ...tools[4].args, concurrencyToken: 'stale-execution-token' };
    const response = await call(
      tools[4].name,
      staleArgs,
      errorReply(-32000, 'The ITP execution concurrency token is no longer current.'),
      staleArgs,
    );
    expect(response.body.result).toBeUndefined();
    expect(response.body.error.message).toMatch(/no longer current/i);
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
