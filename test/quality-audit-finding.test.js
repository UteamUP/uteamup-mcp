/** Governed, GUID-only Quality audit-finding MCP generic-proxy contracts. */
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

describe('Quality audit finding MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_quality_audit_finding';
  const FINDING_GUID = '11111111-1111-4111-8111-111111111111';
  const AUDIT_GUID = '22222222-2222-4222-8222-222222222222';
  const SITE_GUID = '33333333-3333-4333-8333-333333333333';
  const CHECKLIST_ITEM_GUID = '44444444-4444-4444-8444-444444444444';
  const OWNER_GUID = '55555555-5555-4555-8555-555555555555';
  const EVIDENCE_GUID = '66666666-6666-4666-8666-666666666666';
  const DOCUMENT_GUID = '77777777-7777-4777-8777-777777777777';
  const DOCUMENT_VERSION_GUID = '88888888-8888-4888-8888-888888888888';
  const NCR_GUID = '99999999-9999-4999-8999-999999999999';
  const CAPA_GUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const NCR_LINK_GUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const CAPA_LINK_GUID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const IDEMPOTENCY_KEY = 'finding:key/opaque-retry-001';
  const IF_MATCH = '"audit-finding-token-v1"';

  const createRequest = {
    qualityAuditGuid: AUDIT_GUID,
    qualityAuditChecklistItemGuid: CHECKLIST_ITEM_GUID,
    title: 'Procedure control was not effective',
    classification: 'Observation',
    objectiveEvidence: 'Three sampled records omitted the approved verification step.',
    requirementReference: 'ISO 9001:2015 8.5.1',
    ownerUserGuid: OWNER_GUID,
    dueAtUtc: '2026-09-15T12:00:00Z',
  };
  const tools = [
    {
      name: 'UteamupQualityAuditFindingSearch',
      args: {
        siteLocationGuid: SITE_GUID,
        qualityAuditGuid: AUDIT_GUID,
        qualityAuditChecklistItemGuid: CHECKLIST_ITEM_GUID,
        ownerUserGuid: OWNER_GUID,
        classification: 'Observation',
        status: 'Draft',
        dueOnOrAfterUtc: '2026-09-01T00:00:00Z',
        dueBeforeUtc: '2026-10-01T00:00:00Z',
        query: 'procedure control',
        page: 2,
        pageSize: 25,
      },
    },
    {
      name: 'UteamupQualityAuditFindingGet',
      args: { findingGuid: FINDING_GUID },
    },
    {
      name: 'UteamupQualityAuditFindingCreate',
      args: { request: createRequest, idempotencyKey: IDEMPOTENCY_KEY },
    },
    {
      name: 'UteamupQualityAuditFindingUpdate',
      args: {
        findingGuid: FINDING_GUID,
        request: {
          title: 'Updated procedure-control finding',
          classification: 'Observation',
          objectiveEvidence: createRequest.objectiveEvidence,
          requirementReference: createRequest.requirementReference,
          ownerUserGuid: OWNER_GUID,
          dueAtUtc: '2026-09-15T12:00:00Z',
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        ifMatch: IF_MATCH,
      },
    },
    {
      name: 'UteamupQualityAuditFindingTransition',
      args: {
        findingGuid: FINDING_GUID,
        actionKey: 'quality-audit-finding.issue',
        request: {
          attestationText: 'I attest that the retained finding is ready to issue.',
          evidenceGuids: [],
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
    {
      name: 'UteamupQualityAuditFindingEvidenceAdd',
      args: {
        findingGuid: FINDING_GUID,
        request: {
          evidence: {
            documentGuid: DOCUMENT_GUID,
            documentVersionGuid: DOCUMENT_VERSION_GUID,
            purpose: 'AuditEvidence',
            captureSource: 'ExistingDocument',
            confidentialityClassification: 'Internal',
          },
          reason: 'Approved audit-finding evidence.',
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        ifMatch: IF_MATCH,
      },
    },
    {
      name: 'UteamupQualityAuditFindingEvidenceRevoke',
      args: {
        findingGuid: FINDING_GUID,
        evidenceGuid: EVIDENCE_GUID,
        request: {
          reason: 'Superseded association; document and provider content remain retained.',
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
    {
      name: 'UteamupQualityAuditFindingNonConformanceAdd',
      args: {
        findingGuid: FINDING_GUID,
        nonConformanceGuid: NCR_GUID,
        request: { reason: 'Exact NCR raised from the audit finding.' },
        idempotencyKey: IDEMPOTENCY_KEY,
        ifMatch: IF_MATCH,
      },
    },
    {
      name: 'UteamupQualityAuditFindingNonConformanceRevoke',
      args: {
        findingGuid: FINDING_GUID,
        linkGuid: NCR_LINK_GUID,
        request: { reason: 'NCR relationship was entered against the wrong retained record.' },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
    {
      name: 'UteamupQualityAuditFindingCapaAdd',
      args: {
        findingGuid: FINDING_GUID,
        capaGuid: CAPA_GUID,
        request: { reason: 'Exact CAPA governing the corrective response.' },
        idempotencyKey: IDEMPOTENCY_KEY,
        ifMatch: IF_MATCH,
      },
    },
    {
      name: 'UteamupQualityAuditFindingCapaRevoke',
      args: {
        findingGuid: FINDING_GUID,
        linkGuid: CAPA_LINK_GUID,
        request: { reason: 'CAPA relationship was entered against the wrong retained record.' },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    callTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  test('returns a permission-filtered finding search page', async () => {
    const response = await call(
      tools[0].name,
      tools[0].args,
      successReply({
        items: [{
          guid: FINDING_GUID,
          qualityAuditGuid: AUDIT_GUID,
          siteLocationGuid: SITE_GUID,
          displayNumber: 'AUDF-2026-0001',
          title: 'Procedure control was not effective',
          concurrencyToken: 'audit-finding-token-v1',
        }],
        totalCount: 1,
        page: 2,
        pageSize: 25,
      }),
      tools[0].args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.items[0].guid).toBe(FINDING_GUID);
    expect(data.items[0].qualityAuditGuid).toBe(AUDIT_GUID);
    expect(data.items[0]).not.toHaveProperty('id');
  });

  test('preserves an empty scoped search page', async () => {
    const args = { siteLocationGuid: SITE_GUID, page: 1, pageSize: 25 };
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
        concurrencyToken: 'audit-finding-token-v1',
        strongETag: IF_MATCH,
        previewToken: 'server-authenticated-preview-token',
        previewExpiresAtUtc: '2026-08-31T10:10:00Z',
        consequencePreview: {
          operation: 'quality-audit-finding.issue',
          findingGuid: FINDING_GUID,
          canApply: true,
          retainsImmutableHistory: true,
          transition: {
            actionKey: 'quality-audit-finding.issue',
            fromStatus: 'Draft',
            toStatus: 'Open',
            requirements: 'Decision',
          },
        },
      }),
      tools[4].args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.applied).toBe(false);
    expect(data.strongETag).toBe(IF_MATCH);
    expect(data.previewToken).toBe('server-authenticated-preview-token');
    expect(data.consequencePreview.transition.toStatus).toBe('Open');
  });

  test('evidence revocation preview explicitly retains provider content', async () => {
    const response = await call(
      tools[6].name,
      tools[6].args,
      successReply({
        applied: false,
        previewToken: 'retained-evidence-preview-token',
        consequencePreview: {
          operation: 'quality-audit-finding.evidence.revoke',
          findingGuid: FINDING_GUID,
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
  });

  test('relationship revocation preview preserves the exact retained typed link', async () => {
    const response = await call(
      tools[8].name,
      tools[8].args,
      successReply({
        applied: false,
        previewToken: 'retained-ncr-link-preview-token',
        consequencePreview: {
          operation: 'quality-audit-finding.ncr.revoke',
          findingGuid: FINDING_GUID,
          canApply: true,
          retainsImmutableHistory: true,
          relationshipRevocation: {
            linkKind: 'non-conformance',
            linkGuid: NCR_LINK_GUID,
            recordGuid: NCR_GUID,
          },
        },
      }),
      tools[8].args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.consequencePreview.relationshipRevocation.linkGuid).toBe(NCR_LINK_GUID);
    expect(data.consequencePreview.relationshipRevocation.recordGuid).toBe(NCR_GUID);
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

  test('preserves opaque non-GUID idempotency and quoted If-Match values', async () => {
    const update = tools[3];
    const response = await call(
      update.name,
      update.args,
      successReply({ idempotencyKey: IDEMPOTENCY_KEY, ifMatch: IF_MATCH }),
      update.args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(data.ifMatch).toBe(IF_MATCH);
  });

  test('surfaces a stale preview or If-Match conflict as an MCP error', async () => {
    const confirmedArgs = {
      ...tools[4].args,
      confirmed: true,
      previewToken: 'server-authenticated-preview-token',
      ifMatch: '"stale-audit-finding-token"',
    };
    const response = await call(
      tools[4].name,
      confirmedArgs,
      errorReply(-32000, 'The audit-finding consequence preview is no longer current.'),
      confirmedArgs,
    );

    expect(response.body.result).toBeUndefined();
    expect(response.body.error.message).toMatch(/no longer current/i);
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
