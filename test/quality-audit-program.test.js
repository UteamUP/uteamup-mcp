/** Governed, GUID-only Quality audit-programme MCP generic-proxy contracts. */
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

describe('Quality audit programme MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_quality_audit_program';
  const PROGRAMME_GUID = '11111111-1111-4111-8111-111111111111';
  const PROJECT_GUID = '22222222-2222-4222-8222-222222222222';
  const OWNER_GUID = '33333333-3333-4333-8333-333333333333';
  const EVIDENCE_GUID = '44444444-4444-4444-8444-444444444444';
  const DOCUMENT_GUID = '55555555-5555-4555-8555-555555555555';
  const DOCUMENT_VERSION_GUID = '66666666-6666-4666-8666-666666666666';
  const IDEMPOTENCY_KEY = 'audit-program-opaque-retry-key-001';

  const tools = [
    {
      name: 'UteamupQualityAuditProgramSearch',
      args: {
        projectGuid: PROJECT_GUID,
        ownerUserGuid: OWNER_GUID,
        status: 'Draft',
        periodStartsOnOrAfterUtc: '2026-01-01T00:00:00Z',
        periodEndsOnOrBeforeUtc: '2027-01-01T00:00:00Z',
        query: 'risk-based',
        page: 2,
        pageSize: 25,
      },
    },
    {
      name: 'UteamupQualityAuditProgramGet',
      args: { programmeGuid: PROGRAMME_GUID },
    },
    {
      name: 'UteamupQualityAuditProgramCreate',
      args: {
        request: {
          projectGuid: PROJECT_GUID,
          title: 'Risk-based annual audit programme',
          objectives: 'Verify process controls and supplier assurance.',
          riskBasis: 'Prior findings, supplier criticality, and process change.',
          auditUniverse: 'Operations, critical suppliers, and support processes.',
          periodStartUtc: '2026-01-01T00:00:00Z',
          periodEndUtc: '2027-01-01T00:00:00Z',
          ownerUserGuid: OWNER_GUID,
        },
        idempotencyKey: IDEMPOTENCY_KEY,
      },
    },
    {
      name: 'UteamupQualityAuditProgramUpdate',
      args: {
        programmeGuid: PROGRAMME_GUID,
        request: {
          title: 'Updated risk-based annual audit programme',
          objectives: 'Verify process controls and supplier assurance.',
          riskBasis: 'Prior findings, supplier criticality, and process change.',
          auditUniverse: 'Operations, critical suppliers, and support processes.',
          periodStartUtc: '2026-01-01T00:00:00Z',
          periodEndUtc: '2027-01-01T00:00:00Z',
          ownerUserGuid: OWNER_GUID,
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: 'audit-program-token-v1',
      },
    },
    {
      name: 'UteamupQualityAuditProgramTransition',
      args: {
        programmeGuid: PROGRAMME_GUID,
        actionKey: 'quality-audit-program.submit',
        request: { evidenceGuids: [] },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
    {
      name: 'UteamupQualityAuditProgramEvidenceAdd',
      args: {
        programmeGuid: PROGRAMME_GUID,
        request: {
          evidence: {
            documentGuid: DOCUMENT_GUID,
            documentVersionGuid: DOCUMENT_VERSION_GUID,
            purpose: 'AuditEvidence',
            captureSource: 'ExistingDocument',
            confidentialityClassification: 'Internal',
          },
          reason: 'Approved audit-programme evidence.',
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: 'audit-program-token-v1',
      },
    },
    {
      name: 'UteamupQualityAuditProgramEvidenceRevoke',
      args: {
        programmeGuid: PROGRAMME_GUID,
        evidenceGuid: EVIDENCE_GUID,
        request: {
          reason: 'Superseded association; document and provider content remain retained.',
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    callTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  test('returns a permission-filtered audit-programme search page', async () => {
    const response = await call(
      tools[0].name,
      tools[0].args,
      successReply({
        items: [{
          guid: PROGRAMME_GUID,
          displayNumber: 'QAP-2026-0001',
          title: 'Risk-based annual audit programme',
          projectGuid: PROJECT_GUID,
          concurrencyToken: 'audit-program-token-v1',
        }],
        totalCount: 1,
        page: 2,
        pageSize: 25,
      }),
      tools[0].args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.items[0].guid).toBe(PROGRAMME_GUID);
    expect(data.items[0].projectGuid).toBe(PROJECT_GUID);
    expect(data.items[0]).not.toHaveProperty('id');
  });

  test('preserves an empty tenant-wide search page', async () => {
    const args = { page: 1, pageSize: 25 };
    const response = await call(
      tools[0].name,
      args,
      successReply({ items: [], totalCount: 0, page: 1, pageSize: 25 }),
      args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.items).toEqual([]);
    expect(data.totalCount).toBe(0);
  });

  test('preserves a repository-derived transition consequence preview', async () => {
    const response = await call(
      tools[4].name,
      tools[4].args,
      successReply({
        applied: false,
        concurrencyToken: 'audit-program-token-v1',
        strongETag: '"audit-program-token-v1"',
        previewToken: 'server-authenticated-preview-token',
        previewExpiresAtUtc: '2026-08-31T10:10:00Z',
        consequencePreview: {
          operation: 'quality-audit-program.submit',
          programmeGuid: PROGRAMME_GUID,
          canApply: true,
          retainsImmutableHistory: true,
          transition: {
            actionKey: 'quality-audit-program.submit',
            fromStatus: 'Draft',
            toStatus: 'InReview',
            requirements: 'None',
            isTerminal: false,
          },
        },
      }),
      tools[4].args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.applied).toBe(false);
    expect(data.previewToken).toBe('server-authenticated-preview-token');
    expect(data.consequencePreview.transition.fromStatus).toBe('Draft');
    expect(data.consequencePreview.transition.toStatus).toBe('InReview');
  });

  test('evidence revocation preview explicitly retains provider content', async () => {
    const response = await call(
      tools[6].name,
      tools[6].args,
      successReply({
        applied: false,
        previewToken: 'retained-evidence-preview-token',
        consequencePreview: {
          operation: 'quality-audit-program.evidence.revoke',
          programmeGuid: PROGRAMME_GUID,
          canApply: true,
          retainsDocumentAndProviderContent: true,
          retainsImmutableHistory: true,
          evidenceRevocation: {
            evidenceGuid: EVIDENCE_GUID,
            documentGuid: DOCUMENT_GUID,
            documentVersionGuid: DOCUMENT_VERSION_GUID,
          },
        },
      }),
      tools[6].args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.consequencePreview.retainsDocumentAndProviderContent).toBe(true);
    expect(data.consequencePreview.evidenceRevocation.documentGuid).toBe(DOCUMENT_GUID);
    expect(data.consequencePreview.evidenceRevocation.documentVersionGuid)
      .toBe(DOCUMENT_VERSION_GUID);
  });

  test.each(tools)('$name forwards every argument verbatim', async ({ name, args }) => {
    const response = await call(name, args, successReply({ forwarded: true }), args);

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text).forwarded).toBe(true);
  });

  test.each(tools)('$name has no caller-controlled actor or tenant argument', ({ args }) => {
    const forbidden = [
      'tenantGuid',
      'tenantId',
      'actorGuid',
      'userGuid',
      'userId',
      'apiKeyId',
      'apiKeyPrefix',
      'sourceChannel',
      'authoritySnapshotJson',
    ];

    forbidden.forEach(property => expect(args).not.toHaveProperty(property));
  });

  test('surfaces a stale preview or concurrency conflict as an MCP error', async () => {
    const confirmedArgs = {
      ...tools[4].args,
      confirmed: true,
      previewToken: 'server-authenticated-preview-token',
      concurrencyToken: 'stale-audit-program-token',
    };
    const response = await call(
      tools[4].name,
      confirmedArgs,
      errorReply(-32000, 'The audit programme consequence preview is no longer current.'),
      confirmedArgs,
    );

    expect(response.body.result).toBeUndefined();
    expect(response.body.error.message).toMatch(/no longer current/i);
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
