/** Governed, GUID-only Quality workflow-policy MCP generic-proxy contracts. */
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

describe('Quality workflow-policy MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_quality_policy';
  const POLICY_GUID = '11111111-1111-4111-8111-111111111111';
  const SUCCESSOR_GUID = '22222222-2222-4222-8222-222222222222';
  const SITE_GUID = '33333333-3333-4333-8333-333333333333';
  const IDEMPOTENCY_KEY = 'quality-policy-opaque-retry-key-001';
  const CONCURRENCY_TOKEN = 'quality-policy-token-v1';

  const definition = {
    schemaVersion: 2,
    recordKind: 'NonConformance',
    numbering: { prefix: 'NCR', sequencePeriodKind: 'CalendarYear', sequenceWidth: 6 },
    retention: { classification: 'quality-controlled', periodDays: 3650 },
    businessCalendar: { timeZoneId: 'Atlantic/Reykjavik' },
    slaRules: [],
    escalationLadder: [],
    roles: [],
    approvalRules: [],
    transitions: [],
  };

  const tools = [
    {
      name: 'UteamupQualityPolicyDefaultsGet',
      args: { recordKind: 'NonConformance' },
    },
    {
      name: 'UteamupQualityPolicySearch',
      args: {
        recordKind: 'NonConformance',
        status: 'Published',
        scope: 'Tenant',
        siteLocationGuid: SITE_GUID,
        page: 2,
        pageSize: 25,
      },
    },
    {
      name: 'UteamupQualityPolicyGet',
      args: { policyGuid: POLICY_GUID },
    },
    {
      name: 'UteamupQualityPolicyBootstrapDrafts',
      args: { idempotencyKey: IDEMPOTENCY_KEY },
    },
    {
      name: 'UteamupQualityPolicyDraftCreate',
      args: {
        request: {
          recordKind: 'NonConformance',
          scope: 'Tenant',
          requestedVersion: 1,
          effectiveFromUtc: '2026-10-01T00:00:00Z',
          definition,
        },
        idempotencyKey: IDEMPOTENCY_KEY,
      },
    },
    {
      name: 'UteamupQualityPolicyDraftUpdate',
      args: {
        policyGuid: POLICY_GUID,
        request: { effectiveFromUtc: '2026-11-01T00:00:00Z', definition },
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: CONCURRENCY_TOKEN,
      },
    },
    {
      name: 'UteamupQualityPolicySubmitForReview',
      args: {
        policyGuid: POLICY_GUID,
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: CONCURRENCY_TOKEN,
      },
    },
    {
      name: 'UteamupQualityPolicyReturnToDraft',
      args: {
        policyGuid: POLICY_GUID,
        reason: 'Retention classification needs the legal team review.',
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: CONCURRENCY_TOKEN,
      },
    },
    {
      name: 'UteamupQualityPolicyPublish',
      args: {
        policyGuid: POLICY_GUID,
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: CONCURRENCY_TOKEN,
      },
    },
    {
      name: 'UteamupQualityPolicySupersede',
      args: {
        predecessorPolicyGuid: POLICY_GUID,
        successorPolicyGuid: SUCCESSOR_GUID,
        reason: 'Annual review replaces version 1.',
        idempotencyKey: IDEMPOTENCY_KEY,
        predecessorConcurrencyToken: CONCURRENCY_TOKEN,
        successorConcurrencyToken: 'quality-policy-token-v2',
      },
    },
    {
      name: 'UteamupQualityPolicyWithdraw',
      args: {
        policyGuid: POLICY_GUID,
        reason: 'Superseded by the site-specific policy programme.',
        idempotencyKey: IDEMPOTENCY_KEY,
        concurrencyToken: CONCURRENCY_TOKEN,
      },
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    callTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  test('returns the enterprise defaults with the next tenant-scope version', async () => {
    const response = await call(
      tools[0].name,
      tools[0].args,
      successReply({
        recordKind: 'NonConformance',
        timeZoneId: 'Atlantic/Reykjavik',
        defaultDisplayPrefix: 'NCR',
        nextVersion: 1,
        definition,
      }),
      tools[0].args,
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.nextVersion).toBe(1);
    expect(data.definition.numbering.prefix).toBe('NCR');
    expect(data).not.toHaveProperty('id');
  });

  test('bootstrap reports created, existing and unsupported kinds without publishing', async () => {
    const response = await call(
      tools[3].name,
      tools[3].args,
      successReply({
        items: [
          { recordKind: 'NonConformance', outcome: 'created', policyGuid: POLICY_GUID, version: 1, status: 'Draft' },
          { recordKind: 'QualityAudit', outcome: 'existing', policyGuid: SUCCESSOR_GUID, version: 2, status: 'Published' },
          { recordKind: 'ManagementReview', outcome: 'unsupported', policyGuid: null, version: null, status: null },
        ],
        createdCount: 1,
        existingCount: 1,
      }),
      tools[3].args,
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.createdCount).toBe(1);
    expect(data.items.find(item => item.outcome === 'created').status).toBe('Draft');
    expect(data.items.map(item => item.outcome)).toEqual(['created', 'existing', 'unsupported']);
  });

  test('policy reads carry the opaque concurrency token beside the strong ETag', async () => {
    const response = await call(
      tools[2].name,
      tools[2].args,
      successReply({
        policy: { policy: { guid: POLICY_GUID, status: 'InReview', version: 1 }, definition },
        concurrencyToken: CONCURRENCY_TOKEN,
        strongETag: `"${CONCURRENCY_TOKEN}"`,
        wasReplay: false,
      }),
      tools[2].args,
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.policy.policy.guid).toBe(POLICY_GUID);
    expect(data.concurrencyToken).toBe(CONCURRENCY_TOKEN);
    expect(data.strongETag).toBe(`"${CONCURRENCY_TOKEN}"`);
  });

  test('supersede returns both policies and the successor token', async () => {
    const response = await call(
      tools[9].name,
      tools[9].args,
      successReply({
        predecessor: { policy: { guid: POLICY_GUID, status: 'Superseded', version: 1 } },
        successor: { policy: { guid: SUCCESSOR_GUID, status: 'Published', version: 2 } },
        concurrencyToken: 'quality-policy-token-v3',
        strongETag: '"quality-policy-token-v3"',
        wasReplay: false,
      }),
      tools[9].args,
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.predecessor.policy.status).toBe('Superseded');
    expect(data.successor.policy.guid).toBe(SUCCESSOR_GUID);
    expect(data.concurrencyToken).toBe('quality-policy-token-v3');
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
      'publishedByUserGuid',
      'reviewSubmittedByUserGuid',
    ];
    forbidden.forEach(property => expect(args).not.toHaveProperty(property));
  });

  test('surfaces a segregation-of-duties refusal as an MCP error, not a fake success', async () => {
    const response = await call(
      tools[8].name,
      tools[8].args,
      errorReply(-32000, 'Quality policy publication requires an independent publisher.'),
      tools[8].args,
    );
    expect(response.body.result).toBeUndefined();
    expect(response.body.error.message).toMatch(/independent publisher/i);
  });

  test('surfaces a stale concurrency token as an MCP error', async () => {
    const staleArgs = { ...tools[6].args, concurrencyToken: 'stale-quality-policy-token' };
    const response = await call(
      tools[6].name,
      staleArgs,
      errorReply(-32000, 'The Quality policy concurrency token is no longer current.'),
      staleArgs,
    );
    expect(response.body.result).toBeUndefined();
    expect(response.body.error.message).toMatch(/no longer current/i);
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
