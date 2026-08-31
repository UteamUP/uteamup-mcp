/** Governed, GUID-only NCR MCP generic-proxy contracts. */
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

describe('Non-conformance MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_ncr';
  const NCR_GUID = '11111111-1111-4111-8111-111111111111';
  const SITE_GUID = '22222222-2222-4222-8222-222222222222';
  const EVIDENCE_GUID = '33333333-3333-4333-8333-333333333333';
  const DOCUMENT_GUID = '44444444-4444-4444-8444-444444444444';
  const DOCUMENT_VERSION_GUID = '55555555-5555-4555-8555-555555555555';
  const LINK_GUID = '66666666-6666-4666-8666-666666666666';
  const PROJECT_GUID = '77777777-7777-4777-8777-777777777777';
  const IDEMPOTENCY_KEY = '88888888-8888-4888-8888-888888888888';

  const tools = [
    {
      name: 'UteamupNonConformanceSearch',
      args: {
        owningSiteLocationGuid: SITE_GUID,
        status: 'Draft',
        severity: 'Major',
        riskLevel: 'High',
        query: 'ISO 9001',
        page: 2,
        pageSize: 25,
      },
    },
    {
      name: 'UteamupNonConformanceGet',
      args: { nonConformanceGuid: NCR_GUID },
    },
    {
      name: 'UteamupNonConformanceCreate',
      args: {
        request: {
          owningSiteLocationGuid: SITE_GUID,
          title: 'Pressure test failed',
          description: 'The delivered assembly failed pressure testing.',
          requirementReference: 'ISO 9001 8.7',
          requirementStatement: 'The assembly shall pass the approved pressure test.',
          subjectKind: 'Product',
          severity: 'Major',
          riskLevel: 'High',
          detectedAtUtc: '2026-08-31T10:00:00Z',
        },
        idempotencyKey: IDEMPOTENCY_KEY,
      },
    },
    {
      name: 'UteamupNonConformanceUpdate',
      args: {
        nonConformanceGuid: NCR_GUID,
        request: { title: 'Pressure test failed at 8 bar' },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: 'ncr-token-v1',
      },
    },
    {
      name: 'UteamupNonConformanceTransition',
      args: {
        nonConformanceGuid: NCR_GUID,
        actionKey: 'ncr.submit',
        request: { reason: 'Ready for independent triage.' },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
    {
      name: 'UteamupNonConformanceEvidenceAdd',
      args: {
        nonConformanceGuid: NCR_GUID,
        request: {
          evidence: {
            documentGuid: DOCUMENT_GUID,
            documentVersionGuid: DOCUMENT_VERSION_GUID,
          },
          reason: 'Approved test report.',
        },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: 'ncr-token-v1',
      },
    },
    {
      name: 'UteamupNonConformanceEvidenceRevoke',
      args: {
        nonConformanceGuid: NCR_GUID,
        evidenceGuid: EVIDENCE_GUID,
        request: { reason: 'Superseded association; provider content remains retained.' },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
    {
      name: 'UteamupNonConformanceLinkAdd',
      args: {
        nonConformanceGuid: NCR_GUID,
        linkKind: 'project',
        targetGuid: PROJECT_GUID,
        request: { purpose: 'AffectedObject', note: 'Affected release project.' },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: 'ncr-token-v1',
      },
    },
    {
      name: 'UteamupNonConformanceLinkRevoke',
      args: {
        nonConformanceGuid: NCR_GUID,
        linkKind: 'project',
        linkGuid: LINK_GUID,
        request: { reason: 'Relationship entered against the wrong project.' },
        idempotencyKey: IDEMPOTENCY_KEY,
        confirmed: false,
      },
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    callTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  test('returns a permission-filtered NCR search page with typed transition data', async () => {
    const response = await call(
      tools[0].name,
      tools[0].args,
      successReply({
        items: [{
          guid: NCR_GUID,
          displayNumber: 'NCR-2026-0001',
          title: 'Pressure test failed',
          requirementReference: 'ISO 9001 8.7',
          concurrencyToken: 'ncr-token-v1',
        }],
        totalCount: 1,
        page: 2,
        pageSize: 25,
      }),
      tools[0].args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.items[0].guid).toBe(NCR_GUID);
    expect(data.items[0].requirementReference).toBe('ISO 9001 8.7');
    expect(data.items[0]).not.toHaveProperty('id');
  });

  test('preserves an empty scoped search page', async () => {
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
        concurrencyToken: 'ncr-token-v1',
        strongETag: '"ncr-token-v1"',
        previewToken: 'server-authenticated-preview-token',
        previewExpiresAtUtc: '2026-08-31T10:10:00Z',
        consequencePreview: {
          operation: 'ncr.submit',
          nonConformanceGuid: NCR_GUID,
          canApply: true,
          retainsImmutableHistory: true,
          transition: { actionKey: 'ncr.submit', toStatus: 'Submitted', isAvailable: true },
        },
      }),
      tools[4].args,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.applied).toBe(false);
    expect(data.previewToken).toBe('server-authenticated-preview-token');
    expect(data.consequencePreview.transition.actionKey).toBe('ncr.submit');
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
      concurrencyToken: 'stale-ncr-token',
    };
    const response = await call(
      tools[4].name,
      confirmedArgs,
      errorReply(-32000, 'The NCR consequence preview is no longer current.'),
      confirmedArgs,
    );

    expect(response.body.result).toBeUndefined();
    expect(response.body.error.message).toMatch(/no longer current/i);
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
