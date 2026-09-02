/** Governed, GUID-only inspection and test plan MCP generic-proxy contracts. */
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

describe('Quality inspection and test plan MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_quality_itp';
  const PLAN_GUID = '11111111-1111-4111-8111-111111111111';
  const REVISION_GUID = '22222222-2222-4222-8222-222222222222';
  const EVIDENCE_GUID = '33333333-3333-4333-8333-333333333333';
  const PROJECT_GUID = '44444444-4444-4444-8444-444444444444';
  const OWNER_GUID = '55555555-5555-4555-8555-555555555555';
  const IDEMPOTENCY_KEY = 'quality-itp-opaque-retry-key-001';
  const CONCURRENCY_TOKEN = 'quality-itp-token-v1';

  const evidence = {
    documentGuid: '66666666-6666-4666-8666-666666666666',
    documentVersionGuid: '77777777-7777-4777-8777-777777777777',
    purpose: 'SourceRecord',
    captureSource: 'ExistingDocument',
    confidentialityClassification: 'Internal',
  };

  const tools = [
    {
      name: 'UteamupQualityItpSearch',
      args: { projectGuid: PROJECT_GUID, ownerUserGuid: OWNER_GUID, status: 'Draft', query: 'PV-100', page: 1, pageSize: 25 },
    },
    { name: 'UteamupQualityItpGet', args: { planGuid: PLAN_GUID } },
    {
      name: 'UteamupQualityItpCreate',
      args: {
        request: {
          title: 'Pressure vessel PV-100 inspection and test plan',
          scope: 'Fabrication, inspection, pressure testing and final release.',
          productOrProcessContext: 'Pressure vessel PV-100.',
          ownerUserGuid: OWNER_GUID,
          projectGuid: PROJECT_GUID,
        },
        idempotencyKey: IDEMPOTENCY_KEY,
      },
    },
    {
      name: 'UteamupQualityItpUpdate',
      args: {
        planGuid: PLAN_GUID,
        request: { title: 'Pressure vessel PV-100 ITP (rev)', scope: 'Updated scope.', productOrProcessContext: 'PV-100.', ownerUserGuid: OWNER_GUID },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: CONCURRENCY_TOKEN,
      },
    },
    {
      name: 'UteamupQualityItpRevisionCreate',
      args: {
        planGuid: PLAN_GUID,
        request: {
          standardsAndSpecifications: 'ISO 9001:2015 clause 8.6.',
          acceptanceAuthoritySummary: 'Quality manager releases each hold point.',
          changeReason: 'Initial controlled issue.',
          acceptanceAuthorityUserGuid: OWNER_GUID,
          steps: [],
          parties: [],
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: CONCURRENCY_TOKEN,
      },
    },
    {
      name: 'UteamupQualityItpRevisionTransition',
      args: {
        planGuid: PLAN_GUID,
        revisionGuid: REVISION_GUID,
        actionKey: 'itp-revision.submit',
        request: { reason: null, attestationText: null, effectiveAtUtc: null, evidenceGuids: [] },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
    {
      name: 'UteamupQualityItpEvidenceAdd',
      args: {
        planGuid: PLAN_GUID,
        request: { evidence, reason: 'Controlled evidence for the plan.' },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: CONCURRENCY_TOKEN,
      },
    },
    {
      name: 'UteamupQualityItpEvidenceRevoke',
      args: {
        planGuid: PLAN_GUID,
        evidenceGuid: EVIDENCE_GUID,
        request: { reason: 'Superseded by the approved controlled version.' },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    callTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  test('plan reads carry the server-derived revision availability with GUID-only identity', async () => {
    const response = await call(
      tools[1].name,
      tools[1].args,
      successReply({
        plan: { guid: PLAN_GUID, displayNumber: 'ITP-2026-000001', status: 'Draft', concurrencyToken: CONCURRENCY_TOKEN, revisions: [] },
        evidence: [],
        transitionAvailability: {
          options: [{ actionKey: 'itp-revision.submit', revisionGuid: REVISION_GUID, toStatus: 'InReview', isAvailable: true }],
        },
      }),
      tools[1].args,
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.plan.guid).toBe(PLAN_GUID);
    expect(data.transitionAvailability.options[0].revisionGuid).toBe(REVISION_GUID);
    expect(data.plan).not.toHaveProperty('id');
  });

  test('a revision transition preview returns a consequence and token without applying', async () => {
    const response = await call(
      tools[5].name,
      tools[5].args,
      successReply({
        applied: false,
        concurrencyToken: CONCURRENCY_TOKEN,
        strongETag: `"${CONCURRENCY_TOKEN}"`,
        previewToken: 'opaque-preview-token',
        previewExpiresAtUtc: '2026-09-02T12:10:00Z',
        consequencePreview: { operation: 'itp-revision.submit', recordGuid: PLAN_GUID, canApply: true, summary: 'Move revision to InReview.' },
      }),
      tools[5].args,
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.applied).toBe(false);
    expect(data.previewToken).toBe('opaque-preview-token');
    expect(data.consequencePreview.canApply).toBe(true);
  });

  test('a blocked revision transition preview carries the blocked reason and no token', async () => {
    const response = await call(
      tools[5].name,
      tools[5].args,
      successReply({
        applied: false,
        concurrencyToken: CONCURRENCY_TOKEN,
        strongETag: `"${CONCURRENCY_TOKEN}"`,
        consequencePreview: {
          operation: 'itp-revision.submit', recordGuid: PLAN_GUID, canApply: false,
          blockedReasonCode: 'independent_actor_required', blockedReason: 'An ITP revision author cannot review their own revision.',
        },
      }),
      tools[5].args,
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.previewToken).toBeUndefined();
    expect(data.consequencePreview.blockedReasonCode).toBe('independent_actor_required');
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

  test('surfaces an expired preview as an MCP error, not a fake success', async () => {
    const confirmArgs = { ...tools[5].args, confirmed: true, previewToken: 'expired', concurrencyToken: CONCURRENCY_TOKEN };
    const response = await call(
      tools[5].name,
      confirmArgs,
      errorReply(-32000, 'The ITP consequence preview is missing, expired, or no longer current.'),
      confirmArgs,
    );
    expect(response.body.result).toBeUndefined();
    expect(response.body.error.message).toMatch(/no longer current/i);
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
