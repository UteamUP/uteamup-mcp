/** Governed, GUID-only supplier corrective action request MCP generic-proxy contracts (tenant side only). */
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

describe('Quality supplier corrective action request MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_quality_scar';
  const SCAR_GUID = '11111111-1111-4111-8111-111111111111';
  const VENDOR_GUID = '22222222-2222-4222-8222-222222222222';
  const OWNER_GUID = '33333333-3333-4333-8333-333333333333';
  const PART_GUID = '44444444-4444-4444-8444-444444444444';
  const EVIDENCE_GUID = '55555555-5555-4555-8555-555555555555';
  const GRANT_GUID = '66666666-6666-4666-8666-666666666666';
  const PROFILE_GUID = '77777777-7777-4777-8777-777777777777';
  const ACCESS_GUID = '88888888-8888-4888-8888-888888888888';
  const REVISION_GUID = '99999999-9999-4999-8999-999999999999';
  const NCR_GUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const CAPA_GUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const MESSAGE_GUID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const LINK_GUID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const IDEMPOTENCY_KEY = 'quality-scar-opaque-retry-key-001';
  const CONCURRENCY_TOKEN = 'quality-scar-token-v1';

  const tools = [
    {
      name: 'UteamupQualityScarSearch',
      args: { vendorGuid: VENDOR_GUID, status: 'Issued', severity: 'Major', query: 'porosity', page: 1, pageSize: 25 },
    },
    { name: 'UteamupQualityScarGet', args: { scarGuid: SCAR_GUID } },
    {
      name: 'UteamupQualityScarCreate',
      args: {
        request: {
          title: 'Porosity in casting lot 4471',
          problemStatement: 'Radiographic inspection found porosity above the acceptance limit.',
          requirementReference: 'PS-44 section 6.2',
          severity: 'Major',
          containmentRequest: 'Quarantine lot 4471.',
          responseRequirements: 'Root cause, corrective action plan and re-inspection evidence.',
          rootCauseAnalysisRequired: true,
          correctiveActionPlanRequired: true,
          ownerUserGuid: OWNER_GUID,
          supplierAcknowledgementDueAtUtc: '2026-09-04T00:00:00Z',
          containmentDueAtUtc: '2026-09-07T00:00:00Z',
          fullResponseDueAtUtc: '2026-09-16T00:00:00Z',
          costRecoveryStatus: 'NotApplicable',
          vendorGuid: VENDOR_GUID,
          partGuid: PART_GUID,
          sourceNonConformanceLinks: [],
        },
        idempotencyKey: IDEMPOTENCY_KEY,
      },
    },
    {
      name: 'UteamupQualityScarUpdate',
      args: {
        scarGuid: SCAR_GUID,
        request: { title: 'Porosity in casting lot 4471 (rev)', ownerUserGuid: OWNER_GUID },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: CONCURRENCY_TOKEN,
      },
    },
    {
      name: 'UteamupQualityScarTransition',
      args: {
        scarGuid: SCAR_GUID,
        actionKey: 'scar.submit',
        request: { reason: null, attestationText: null, evidenceGuids: [] },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
    {
      name: 'UteamupQualityScarEvidenceAdd',
      args: {
        scarGuid: SCAR_GUID,
        request: {
          evidence: {
            documentGuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            documentVersionGuid: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            purpose: 'SourceRecord',
            captureSource: 'ExistingDocument',
            confidentialityClassification: 'Internal',
          },
          reason: 'Radiographic report.',
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: CONCURRENCY_TOKEN,
      },
    },
    {
      name: 'UteamupQualityScarEvidenceRevoke',
      args: { scarGuid: SCAR_GUID, evidenceGuid: EVIDENCE_GUID, request: { reason: 'Wrong report attached.' }, idempotencyKey: IDEMPOTENCY_KEY, confirmed: false },
    },
    {
      name: 'UteamupQualityScarGrantCreate',
      args: {
        scarGuid: SCAR_GUID,
        request: {
          contractorProfileGuid: PROFILE_GUID,
          contractorTenantAccessGuid: ACCESS_GUID,
          allowedActions: 'view, acknowledge, decline, submitContainment, submitResponse, linkEvidence',
          validFromUtc: '2026-09-02T00:00:00Z',
          expiresAtUtc: '2026-10-02T00:00:00Z',
          requiredTermsVersion: 'supplier-terms-v2',
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: CONCURRENCY_TOKEN,
      },
    },
    {
      name: 'UteamupQualityScarGrantRevoke',
      args: { scarGuid: SCAR_GUID, grantGuid: GRANT_GUID, request: { reason: 'Contact left the supplier.' }, idempotencyKey: IDEMPOTENCY_KEY, confirmed: false },
    },
    {
      name: 'UteamupQualityScarResponseReview',
      args: {
        scarGuid: SCAR_GUID,
        request: { responseRevisionGuid: REVISION_GUID, outcome: 'Accepted', reason: 'The corrective action plan is accepted.', evidenceGuids: [] },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
    {
      name: 'UteamupQualityScarEffectivenessVerify',
      args: {
        scarGuid: SCAR_GUID,
        request: { result: 'Effective', summary: 'Defect rate back within limits.', attestationText: 'Verified on site.', reason: null, evidenceGuids: [EVIDENCE_GUID] },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
    {
      name: 'UteamupQualityScarNonConformanceAdd',
      args: { scarGuid: SCAR_GUID, nonConformanceGuid: NCR_GUID, request: { sourceReason: 'Receiving inspection finding.' }, idempotencyKey: IDEMPOTENCY_KEY, concurrencyToken: CONCURRENCY_TOKEN },
    },
    {
      name: 'UteamupQualityScarCapaAdd',
      args: { scarGuid: SCAR_GUID, capaGuid: CAPA_GUID, request: { followUpReason: 'Supplier audit follow-up.' }, idempotencyKey: IDEMPOTENCY_KEY, concurrencyToken: CONCURRENCY_TOKEN },
    },
    {
      name: 'UteamupQualityScarCommunicationAdd',
      args: { scarGuid: SCAR_GUID, request: { vendorMessageGuid: MESSAGE_GUID, purpose: 'Issue' }, idempotencyKey: IDEMPOTENCY_KEY, concurrencyToken: CONCURRENCY_TOKEN },
    },
    {
      name: 'UteamupQualityScarLinkRevoke',
      args: { scarGuid: SCAR_GUID, linkKind: 'Capa', linkGuid: LINK_GUID, request: { reason: 'Linked to the wrong CAPA.' }, idempotencyKey: IDEMPOTENCY_KEY, confirmed: false },
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    callTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  test('SCAR reads carry grants, supplier responses and the internal availability only', async () => {
    const response = await call(
      tools[1].name,
      tools[1].args,
      successReply({
        scar: { guid: SCAR_GUID, displayNumber: 'SCAR-2026-000001', status: 'Issued', vendorGuid: VENDOR_GUID, concurrencyToken: CONCURRENCY_TOKEN, responseRevisions: [] },
        externalGrants: [{ guid: GRANT_GUID, contractorProfileGuid: PROFILE_GUID, allowedActions: 'view, acknowledge' }],
        evidence: [],
        transitionAvailability: { options: [{ actionKey: 'scar.withdraw', toStatus: 'Withdrawn', isAvailable: true }] },
      }),
      tools[1].args,
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.scar.guid).toBe(SCAR_GUID);
    expect(data.externalGrants[0].guid).toBe(GRANT_GUID);
    expect(data.transitionAvailability.options.map(option => option.actionKey)).toEqual(['scar.withdraw']);
    expect(data.scar).not.toHaveProperty('id');
  });

  test('a response review preview names the lifecycle key the outcome selects', async () => {
    const response = await call(
      tools[9].name,
      tools[9].args,
      successReply({
        applied: false,
        concurrencyToken: CONCURRENCY_TOKEN,
        strongETag: `"${CONCURRENCY_TOKEN}"`,
        previewToken: 'opaque-preview-token',
        consequencePreview: { operation: 'scar.response.review', scarGuid: SCAR_GUID, canApply: true, transition: { actionKey: 'scar.accept-response', toStatus: 'Implementation', isAvailable: true } },
      }),
      tools[9].args,
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.consequencePreview.transition.actionKey).toBe('scar.accept-response');
    expect(data.previewToken).toBe('opaque-preview-token');
  });

  test('a blocked effectiveness verdict preview carries the independence block and no token', async () => {
    const response = await call(
      tools[10].name,
      tools[10].args,
      successReply({
        applied: false,
        concurrencyToken: CONCURRENCY_TOKEN,
        strongETag: `"${CONCURRENCY_TOKEN}"`,
        consequencePreview: { operation: 'scar.effectiveness.verify', scarGuid: SCAR_GUID, canApply: false, blockedReasonCode: 'independent_actor_required' },
      }),
      tools[10].args,
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

  test.each(tools)('$name has no caller-controlled actor, tenant or supplier-grant argument', ({ args }) => {
    ['tenantGuid', 'tenantId', 'actorGuid', 'userGuid', 'userId', 'apiKeyId', 'apiKeyPrefix', 'sourceChannel', 'grantHolderUserGuid']
      .forEach(property => expect(args).not.toHaveProperty(property));
  });

  test('a supplier-only lifecycle key is refused by the backend and surfaced as an MCP error', async () => {
    const supplierArgs = { ...tools[4].args, actionKey: 'scar.supplier-acknowledge' };
    const response = await call(
      tools[4].name,
      supplierArgs,
      errorReply(-32000, 'An exact supported internal SCAR transition is required.'),
      supplierArgs,
    );
    expect(response.body.result).toBeUndefined();
    expect(response.body.error.message).toMatch(/internal SCAR transition/i);
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
