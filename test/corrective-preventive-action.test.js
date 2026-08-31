/** Governed, GUID-only CAPA MCP generic-proxy contracts. */
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

describe('Corrective and preventive action MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_capa';
  const CAPA_GUID = '11111111-1111-4111-8111-111111111111';
  const SITE_GUID = '22222222-2222-4222-8222-222222222222';
  const EVIDENCE_GUID = '33333333-3333-4333-8333-333333333333';
  const DOCUMENT_GUID = '44444444-4444-4444-8444-444444444444';
  const DOCUMENT_VERSION_GUID = '55555555-5555-4555-8555-555555555555';
  const SOURCE_LINK_GUID = '66666666-6666-4666-8666-666666666666';
  const NCR_GUID = '77777777-7777-4777-8777-777777777777';
  const PROJECT_GUID = '88888888-8888-4888-8888-888888888888';
  const RCA_GUID = '99999999-9999-4999-8999-999999999999';
  const IDEMPOTENCY_KEY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const tools = [
    {
      name: 'UteamupCorrectivePreventiveActionSearch',
      args: {
        owningSiteLocationGuid: SITE_GUID,
        ownerUserGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        status: 'Assessment',
        type: 'Corrective',
        initialRiskLevel: 'High',
        query: 'pressure test',
        page: 2,
        pageSize: 25,
      },
    },
    {
      name: 'UteamupCorrectivePreventiveActionGet',
      args: { correctivePreventiveActionGuid: CAPA_GUID },
    },
    {
      name: 'UteamupCorrectivePreventiveActionCreate',
      args: {
        request: {
          owningSiteLocationGuid: SITE_GUID,
          improvementProjectGuid: PROJECT_GUID,
          rootCauseAnalysisGuid: RCA_GUID,
          title: 'Prevent recurrence of failed pressure tests',
          type: 'Corrective',
          problemStatement: 'The delivered assembly failed the approved test.',
          systemicImpactStatement: 'The inspection control may affect similar assemblies.',
          initialRiskLevel: 'High',
          sourceNonConformanceLinks: [{
            nonConformanceGuid: NCR_GUID,
            sourceReason: 'Authoritative originating NCR.',
          }],
        },
        idempotencyKey: IDEMPOTENCY_KEY,
      },
    },
    {
      name: 'UteamupCorrectivePreventiveActionUpdate',
      args: {
        correctivePreventiveActionGuid: CAPA_GUID,
        request: {
          title: 'Prevent recurrence across the product family',
          type: 'Corrective',
          problemStatement: 'The delivered assembly failed the approved test.',
          systemicImpactStatement: 'The inspection control affects the product family.',
          initialRiskLevel: 'High',
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: 'capa-token-v1',
      },
    },
    {
      name: 'UteamupCorrectivePreventiveActionTransition',
      args: {
        correctivePreventiveActionGuid: CAPA_GUID,
        actionKey: 'capa.submit',
        request: { reason: 'Ready for independent assessment.' },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: 'capa-token-v1',
        confirmed: false,
      },
    },
    {
      name: 'UteamupCorrectivePreventiveActionEvidenceAdd',
      args: {
        correctivePreventiveActionGuid: CAPA_GUID,
        request: {
          evidence: {
            documentGuid: DOCUMENT_GUID,
            documentVersionGuid: DOCUMENT_VERSION_GUID,
          },
          reason: 'Approved implementation evidence.',
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: 'capa-token-v1',
      },
    },
    {
      name: 'UteamupCorrectivePreventiveActionEvidenceRevoke',
      args: {
        correctivePreventiveActionGuid: CAPA_GUID,
        evidenceGuid: EVIDENCE_GUID,
        request: {
          reason: 'Superseded association; document, version, and provider content remain retained.',
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: 'capa-token-v1',
        confirmed: false,
      },
    },
    {
      name: 'UteamupCorrectivePreventiveActionSourceNonConformanceAdd',
      args: {
        correctivePreventiveActionGuid: CAPA_GUID,
        nonConformanceGuid: NCR_GUID,
        request: {
          nonConformanceGuid: NCR_GUID,
          sourceReason: 'Additional retained source NCR.',
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: 'capa-token-v1',
      },
    },
    {
      name: 'UteamupCorrectivePreventiveActionSourceNonConformanceRevoke',
      args: {
        correctivePreventiveActionGuid: CAPA_GUID,
        sourceLinkGuid: SOURCE_LINK_GUID,
        request: { reason: 'Incorrect association; source NCR and history remain retained.' },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: 'capa-token-v1',
        confirmed: false,
      },
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    callTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  test('returns a permission-filtered CAPA search page', async () => {
    const response = await call(
      tools[0].name,
      tools[0].args,
      successReply({
        items: [{
          guid: CAPA_GUID,
          displayNumber: 'CAPA-2026-0001',
          title: 'Prevent recurrence of failed pressure tests',
          improvementProjectGuid: PROJECT_GUID,
          concurrencyToken: 'capa-token-v1',
        }],
        totalCount: 1,
        page: 2,
        pageSize: 25,
      }),
      tools[0].args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.items[0].guid).toBe(CAPA_GUID);
    expect(data.items[0].improvementProjectGuid).toBe(PROJECT_GUID);
    expect(data.items[0]).not.toHaveProperty('id');
  });

  test('preserves an empty scoped CAPA search page', async () => {
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

  test('preserves a side-effect-free typed transition consequence preview', async () => {
    const response = await call(
      tools[4].name,
      tools[4].args,
      successReply({
        applied: false,
        concurrencyToken: 'capa-token-v1',
        strongETag: '"capa-token-v1"',
        previewToken: 'server-authenticated-preview-token',
        previewExpiresAtUtc: '2026-08-31T10:10:00Z',
        consequencePreview: {
          operation: 'capa.submit',
          correctivePreventiveActionGuid: CAPA_GUID,
          canApply: true,
          retainsImmutableHistory: true,
          transition: {
            actionKey: 'capa.submit',
            fromStatus: 'Draft',
            toStatus: 'Assessment',
            requirements: 'None',
          },
        },
      }),
      tools[4].args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.applied).toBe(false);
    expect(data.previewToken).toBe('server-authenticated-preview-token');
    expect(data.consequencePreview.transition.actionKey).toBe('capa.submit');
  });

  test('evidence revocation preview explicitly retains provider content', async () => {
    const response = await call(
      tools[6].name,
      tools[6].args,
      successReply({
        applied: false,
        previewToken: 'retained-evidence-preview-token',
        consequencePreview: {
          operation: 'capa.evidence.revoke',
          correctivePreventiveActionGuid: CAPA_GUID,
          canApply: true,
          summary: 'The exact document version and external provider content remain retained.',
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

  test('source revocation preview explicitly retains the NCR and immutable history', async () => {
    const response = await call(
      tools[8].name,
      tools[8].args,
      successReply({
        applied: false,
        previewToken: 'retained-source-preview-token',
        consequencePreview: {
          operation: 'capa.source-non-conformance.revoke',
          correctivePreventiveActionGuid: CAPA_GUID,
          canApply: true,
          summary: 'The source NCR and complete immutable link history remain retained.',
          retainsImmutableHistory: true,
          sourceRevocation: {
            sourceLinkGuid: SOURCE_LINK_GUID,
            nonConformanceGuid: NCR_GUID,
          },
        },
      }),
      tools[8].args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.consequencePreview.sourceRevocation.nonConformanceGuid).toBe(NCR_GUID);
    expect(data.consequencePreview.retainsImmutableHistory).toBe(true);
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

  test('surfaces a stale preview or concurrency conflict without converting it to success', async () => {
    const confirmedArgs = {
      ...tools[4].args,
      confirmed: true,
      previewToken: 'server-authenticated-preview-token',
      concurrencyToken: 'stale-capa-token',
    };
    const response = await call(
      tools[4].name,
      confirmedArgs,
      errorReply(-32000, 'The CAPA consequence preview is no longer current.'),
      confirmedArgs,
    );

    expect(response.body.result).toBeUndefined();
    expect(response.body.error.message).toMatch(/no longer current/i);
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
