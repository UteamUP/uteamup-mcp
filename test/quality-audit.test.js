/** Governed, GUID-only main Quality-audit MCP generic-proxy contracts. */
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

describe('Quality audit MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_quality_audit';
  const AUDIT_GUID = '11111111-1111-4111-8111-111111111111';
  const PROGRAMME_GUID = '22222222-2222-4222-8222-222222222222';
  const SITE_GUID = '33333333-3333-4333-8333-333333333333';
  const VENDOR_GUID = '44444444-4444-4444-8444-444444444444';
  const CHECKLIST_GUID = '55555555-5555-4555-8555-555555555555';
  const ASSIGNMENT_GUID = '66666666-6666-4666-8666-666666666666';
  const CHECKLIST_ITEM_GUID = '77777777-7777-4777-8777-777777777777';
  const EVIDENCE_GUID = '88888888-8888-4888-8888-888888888888';
  const DOCUMENT_GUID = '99999999-9999-4999-8999-999999999999';
  const DOCUMENT_VERSION_GUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const ACTOR_GUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const IDEMPOTENCY_KEY = 'audit:key/opaque-retry-001';
  const CONCURRENCY_TOKEN = 'audit-token-v1';

  const evidenceGuids = [EVIDENCE_GUID];
  const tools = [
    {
      name: 'UteamupQualityAuditSearch',
      args: {
        siteLocationGuid: SITE_GUID,
        qualityAuditProgramGuid: PROGRAMME_GUID,
        vendorGuid: VENDOR_GUID,
        leadAuditorUserGuid: ACTOR_GUID,
        status: 'Planned',
        type: 'Supplier',
        scheduledOnOrAfterUtc: '2026-09-01T00:00:00Z',
        scheduledBeforeUtc: '2026-10-01T00:00:00Z',
        query: 'critical supplier',
        page: 2,
        pageSize: 25,
      },
    },
    {
      name: 'UteamupQualityAuditGet',
      args: { auditGuid: AUDIT_GUID },
    },
    {
      name: 'UteamupQualityAuditCreate',
      args: {
        request: {
          qualityAuditProgramGuid: PROGRAMME_GUID,
          siteLocationGuid: SITE_GUID,
          vendorGuid: VENDOR_GUID,
          sourceCheckListGuid: CHECKLIST_GUID,
          title: 'Critical supplier quality audit',
          type: 'Supplier',
          scope: 'Supplier production and release controls.',
          criteria: 'Approved agreement and controlled inspection criteria.',
          objective: 'Verify conformity and effective supplier controls.',
          scheduledStartAtUtc: '2026-09-01T08:00:00Z',
          scheduledEndAtUtc: '2026-09-02T16:00:00Z',
          assignments: [{
            assignedUserGuid: ACTOR_GUID,
            role: 'LeadAuditor',
            competenceEvidenceSummary: 'Approved auditor competence record.',
          }],
        },
        idempotencyKey: IDEMPOTENCY_KEY,
      },
    },
    {
      name: 'UteamupQualityAuditUpdate',
      args: {
        auditGuid: AUDIT_GUID,
        request: {
          title: 'Updated critical supplier quality audit',
          type: 'Supplier',
          scope: 'Supplier production, inspection, and release controls.',
          criteria: 'Approved agreement and controlled inspection criteria.',
          objective: 'Verify conformity and effective supplier controls.',
          scheduledStartAtUtc: '2026-09-01T08:00:00Z',
          scheduledEndAtUtc: '2026-09-02T16:00:00Z',
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: CONCURRENCY_TOKEN,
      },
    },
    {
      name: 'UteamupQualityAuditTransition',
      args: {
        auditGuid: AUDIT_GUID,
        actionKey: 'quality-audit.approve-plan',
        request: {
          attestationText: 'I attest that the retained audit plan is ready for approval.',
          evidenceGuids,
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
    {
      name: 'UteamupQualityAuditAssignmentCompetenceVerify',
      args: {
        auditGuid: AUDIT_GUID,
        assignmentGuid: ASSIGNMENT_GUID,
        request: {
          attestationText: 'The retained competence evidence was verified.',
          evidenceGuids,
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
    {
      name: 'UteamupQualityAuditAssignmentIndependenceReview',
      args: {
        auditGuid: AUDIT_GUID,
        assignmentGuid: ASSIGNMENT_GUID,
        request: {
          result: 'Independent',
          attestationText: 'No conflicts were found in the retained review.',
          evidenceGuids,
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
    {
      name: 'UteamupQualityAuditAssignmentAccept',
      args: {
        auditGuid: AUDIT_GUID,
        assignmentGuid: ASSIGNMENT_GUID,
        request: {
          attestationText: 'I accept this exact audit assignment.',
          evidenceGuids,
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
    {
      name: 'UteamupQualityAuditAssignmentRemove',
      args: {
        auditGuid: AUDIT_GUID,
        assignmentGuid: ASSIGNMENT_GUID,
        request: {
          reason: 'The retained assignment was superseded by an approved replacement.',
          evidenceGuids,
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
    {
      name: 'UteamupQualityAuditChecklistEvaluate',
      args: {
        auditGuid: AUDIT_GUID,
        checklistItemGuid: CHECKLIST_ITEM_GUID,
        request: {
          result: 'Conforming',
          evidenceSummary: 'The sampled controlled records met the criterion.',
          evidenceGuids,
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
    {
      name: 'UteamupQualityAuditEvidenceAdd',
      args: {
        auditGuid: AUDIT_GUID,
        request: {
          evidence: {
            documentGuid: DOCUMENT_GUID,
            documentVersionGuid: DOCUMENT_VERSION_GUID,
            purpose: 'AuditEvidence',
            captureSource: 'ExistingDocument',
            confidentialityClassification: 'Internal',
          },
          reason: 'Approved retained audit evidence.',
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: CONCURRENCY_TOKEN,
      },
    },
    {
      name: 'UteamupQualityAuditEvidenceRevoke',
      args: {
        auditGuid: AUDIT_GUID,
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

  test('returns a permission-filtered GUID-only audit search page', async () => {
    const response = await call(
      tools[0].name,
      tools[0].args,
      successReply({
        items: [{
          guid: AUDIT_GUID,
          siteLocationGuid: SITE_GUID,
          qualityAuditProgramGuid: PROGRAMME_GUID,
          displayNumber: 'AUD-2026-0001',
          title: 'Critical supplier quality audit',
          concurrencyToken: CONCURRENCY_TOKEN,
        }],
        totalCount: 1,
        page: 2,
        pageSize: 25,
      }),
      tools[0].args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.items[0].guid).toBe(AUDIT_GUID);
    expect(data.items[0].siteLocationGuid).toBe(SITE_GUID);
    expect(data.items[0]).not.toHaveProperty('id');
  });

  test('preserves a repository-derived transition consequence preview', async () => {
    const response = await call(
      tools[4].name,
      tools[4].args,
      successReply({
        applied: false,
        concurrencyToken: CONCURRENCY_TOKEN,
        strongETag: `"${CONCURRENCY_TOKEN}"`,
        previewToken: 'server-authenticated-preview-token',
        previewExpiresAtUtc: '2026-08-31T10:10:00Z',
        consequencePreview: {
          operation: 'quality-audit.approve-plan',
          auditGuid: AUDIT_GUID,
          canApply: true,
          retainsImmutableHistory: true,
          transition: {
            actionKey: 'quality-audit.approve-plan',
            fromStatus: 'Planned',
            toStatus: 'PlanApproved',
            requirements: 'Decision',
            isTerminal: false,
          },
        },
      }),
      tools[4].args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.applied).toBe(false);
    expect(data.previewToken).toBe('server-authenticated-preview-token');
    expect(data.consequencePreview.transition.fromStatus).toBe('Planned');
    expect(data.consequencePreview.transition.toStatus).toBe('PlanApproved');
  });

  test('preserves exact assignment before-and-after consequence state', async () => {
    const response = await call(
      tools[5].name,
      tools[5].args,
      successReply({
        applied: false,
        previewToken: 'assignment-competence-preview-token',
        consequencePreview: {
          operation: 'quality-audit.assignment.competence-verified',
          auditGuid: AUDIT_GUID,
          canApply: true,
          retainsImmutableHistory: true,
          assignmentOperation: {
            kind: 'VerifyAssignmentCompetence',
            assignmentGuid: ASSIGNMENT_GUID,
            assignedUserGuid: ACTOR_GUID,
            fromCompetenceVerified: false,
            toCompetenceVerified: true,
          },
        },
      }),
      tools[5].args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.consequencePreview.assignmentOperation.assignmentGuid).toBe(ASSIGNMENT_GUID);
    expect(data.consequencePreview.assignmentOperation.fromCompetenceVerified).toBe(false);
    expect(data.consequencePreview.assignmentOperation.toCompetenceVerified).toBe(true);
  });

  test('evidence revocation explicitly retains document, version, and provider content', async () => {
    const response = await call(
      tools[11].name,
      tools[11].args,
      successReply({
        applied: false,
        previewToken: 'retained-evidence-preview-token',
        consequencePreview: {
          operation: 'quality-audit.evidence.revoke',
          auditGuid: AUDIT_GUID,
          canApply: true,
          retainsDocumentAndProviderContent: true,
          retainsImmutableHistory: true,
          evidenceRevocation: {
            evidenceGuid: EVIDENCE_GUID,
            documentGuid: DOCUMENT_GUID,
            documentVersionGuid: DOCUMENT_VERSION_GUID,
            retainsDocument: true,
            retainsDocumentVersion: true,
            retainsExternalProviderContent: true,
          },
        },
      }),
      tools[11].args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.consequencePreview.retainsDocumentAndProviderContent).toBe(true);
    expect(data.consequencePreview.evidenceRevocation.documentGuid).toBe(DOCUMENT_GUID);
    expect(data.consequencePreview.evidenceRevocation.documentVersionGuid)
      .toBe(DOCUMENT_VERSION_GUID);
    expect(data.consequencePreview.evidenceRevocation.retainsExternalProviderContent).toBe(true);
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

  test('preserves opaque non-GUID idempotency and concurrency tokens', async () => {
    const update = tools[3];
    const response = await call(
      update.name,
      update.args,
      successReply({
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: CONCURRENCY_TOKEN,
      }),
      update.args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(data.concurrencyToken).toBe(CONCURRENCY_TOKEN);
  });

  test('surfaces a stale preview or concurrency conflict as an MCP error', async () => {
    const confirmedArgs = {
      ...tools[4].args,
      confirmed: true,
      previewToken: 'server-authenticated-preview-token',
      concurrencyToken: 'stale-audit-token',
    };
    const response = await call(
      tools[4].name,
      confirmedArgs,
      errorReply(-32000, 'The Quality audit consequence preview is no longer current.'),
      confirmedArgs,
    );

    expect(response.body.result).toBeUndefined();
    expect(response.body.error.message).toMatch(/no longer current/i);
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
