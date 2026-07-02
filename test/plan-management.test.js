/**
 * Plan Management MCP tool tests
 *
 * Covers the Part 2 plan-management read tools which proxy to the backend:
 *   - UteamupPlanLimitsGet            → GET /api/planlimit/by-plan/{planGuid}
 *   - UteamupPricingRulesList         → GET /api/pricingrule
 *   - UteamupPlanAnalyticsSummary     → GET /api/plananalytics/summary
 *   - UteamupPlanApprovalsPending     → GET /api/planapproval/pending
 *   - UteamupTenantFeatureOverridesGet → GET /api/tenantfeatureoverride/by-tenant/{tenantGuid}
 *
 * Verifies that the MCP proxy:
 *   - Forwards tools/call requests as JSON-RPC 2.0
 *   - Forwards GUID/date arguments verbatim
 *   - Handles successful backend responses
 *   - Handles empty result sets
 *   - Handles backend errors (401, 503, JSON-RPC error shape)
 *
 * Pattern mirrors plan-audit-history.test.js: raw nock-mocked HTTPS calls that
 * simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const https = require('https');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Plan Management MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_plan_management';
  const PLAN_GUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const TENANT_GUID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  /** Raw JSON-RPC round-trip with a body-matching nock interceptor: proves the
   *  named args are forwarded verbatim (a dropped/mangled arg would 404). */
  const rawCall = (toolName, toolArgs, id) => {
    const request = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: toolArgs },
      id,
    };

    return new Promise((resolve, reject) => {
      const data = JSON.stringify(request);
      const req = https.request(`${BASE_URL}/mcp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Content-Length': Buffer.byteLength(data),
        },
        rejectUnauthorized: false,
      }, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: responseData }));
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  };

  // ---------------------------------------------------------------------------
  // Shared mock data — matches the backend response models (camelCase)
  // ---------------------------------------------------------------------------
  const mockLimits = [
    {
      guid: '11111111-1111-1111-1111-111111111111',
      planGuid: PLAN_GUID,
      dimension: 'Users',
      maxValue: 25,
    },
    {
      guid: '22222222-2222-2222-2222-222222222222',
      planGuid: PLAN_GUID,
      dimension: 'Assets',
      maxValue: null,
    },
  ];

  const mockRules = [
    {
      guid: '33333333-3333-3333-3333-333333333333',
      name: 'Iceland yearly 10%',
      isActive: true,
      priority: 10,
      countryCode: 'IS',
      billingCycle: 'Yearly',
      planSku: null,
      minTenantAgeDays: null,
      discountPercent: 10,
      effectiveFrom: '2026-01-01T00:00:00Z',
      effectiveTo: null,
    },
    {
      guid: '44444444-4444-4444-4444-444444444444',
      name: 'Legacy launch promo',
      isActive: false,
      priority: 100,
      countryCode: null,
      billingCycle: null,
      planSku: 'pro',
      minTenantAgeDays: 30,
      discountPercent: 25,
      effectiveFrom: '2025-01-01T00:00:00Z',
      effectiveTo: '2025-12-31T23:59:59Z',
    },
  ];

  const mockSummary = {
    fromDate: '2026-04-03T00:00:00Z',
    plans: [
      {
        planGuid: PLAN_GUID,
        planName: 'Pro',
        activeSubscribers: 12,
        grandfatheredSubscribers: 3,
        paidRevenueIsk: 588000,
        promotionDiscountIsk: 29400,
        ruleDiscountIsk: 11760,
      },
    ],
    recentPlanChanges: 4,
  };

  const mockPending = [
    {
      guid: '55555555-5555-5555-5555-555555555555',
      planGuid: PLAN_GUID,
      status: 'Pending',
      proposedChanges: { name: 'Pro', monthlyPrice: 59 },
      requestedByUserId: 'admin-1',
      requestedByUserGuid: '99999999-9999-9999-9999-999999999999',
      resolvedByUserId: null,
      createdAt: '2026-06-20T09:00:00Z',
      resolvedAt: null,
    },
  ];

  const mockOverrides = [
    {
      guid: '66666666-6666-6666-6666-666666666666',
      tenantGuid: TENANT_GUID,
      featureCatalogGuid: '77777777-7777-7777-7777-777777777777',
      featureName: 'IndustryCoding',
      mode: 'Grant',
      reason: 'Pilot customer',
    },
  ];

  // ---------------------------------------------------------------------------
  // UteamupPlanLimitsGet
  // ---------------------------------------------------------------------------
  describe('UteamupPlanLimitsGet tool', () => {
    test('returns the plan limits, one row per dimension', async () => {
      const response = await call(
        'UteamupPlanLimitsGet',
        { planGuid: PLAN_GUID },
        successReply(mockLimits),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(2);
      expect(data[0].dimension).toBe('Users');
      expect(data[0].maxValue).toBe(25);
      // null maxValue = unlimited dimension
      expect(data[1].maxValue).toBeNull();
      // GUIDs-in/integer-ids-out: identity and plan reference must be GUIDs
      // at the public boundary — never leak the internal int id.
      expect(data[0].guid).toBe('11111111-1111-1111-1111-111111111111');
      expect(data[0].planGuid).toBe(PLAN_GUID);
      expect(data[0]).not.toHaveProperty('id');
    });

    test('returns empty list when the plan has no limits', async () => {
      const response = await call(
        'UteamupPlanLimitsGet',
        { planGuid: PLAN_GUID },
        successReply([]),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toEqual([]);
    });

    test('forwards the planGuid argument verbatim to the backend', async () => {
      nock(BASE_URL)
        .post('/mcp', body =>
          body.method === 'tools/call' &&
          body.params?.name === 'UteamupPlanLimitsGet' &&
          body.params?.arguments?.planGuid === PLAN_GUID)
        .reply(200, JSON.stringify(successReply(mockLimits).body), {
          'Content-Type': 'application/json',
        });

      const response = await rawCall('UteamupPlanLimitsGet', { planGuid: PLAN_GUID }, 7101);
      expect(response.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupPricingRulesList
  // ---------------------------------------------------------------------------
  describe('UteamupPricingRulesList tool', () => {
    test('returns all pricing rules including inactive ones', async () => {
      const response = await call(
        'UteamupPricingRulesList',
        {},
        successReply(mockRules),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe('Iceland yearly 10%');
      expect(data[0].isActive).toBe(true);
      expect(data[1].isActive).toBe(false);
      expect(data[0].guid).toBe('33333333-3333-3333-3333-333333333333');
      expect(data[0]).not.toHaveProperty('id');
    });

    test('returns empty list when no pricing rules exist', async () => {
      const response = await call(
        'UteamupPricingRulesList',
        {},
        successReply([]),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toEqual([]);
    });

    test('takes no userId/tenantId argument — identity comes from the Bearer token', async () => {
      // Regression guard: adding caller-identity args to a permission-scoped
      // list tool would silently invite spoofing.
      nock(BASE_URL)
        .post('/mcp', body =>
          body.method === 'tools/call' &&
          body.params?.name === 'UteamupPricingRulesList' &&
          Object.keys(body.params?.arguments ?? {}).length === 0)
        .reply(200, JSON.stringify(successReply(mockRules).body), {
          'Content-Type': 'application/json',
        });

      const response = await rawCall('UteamupPricingRulesList', {}, 7102);
      expect(response.status).toBe(200);
    });

    test('handles backend error responses in JSON-RPC error shape', async () => {
      const response = await call(
        'UteamupPricingRulesList',
        {},
        errorReply(-32603, 'Internal error: database unavailable'),
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32603);
      expect(response.body.error.message).toContain('database unavailable');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupPlanAnalyticsSummary
  // ---------------------------------------------------------------------------
  describe('UteamupPlanAnalyticsSummary tool', () => {
    test('returns the per-plan analytics summary', async () => {
      const response = await call(
        'UteamupPlanAnalyticsSummary',
        {},
        successReply(mockSummary),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.plans).toHaveLength(1);
      expect(data.plans[0].planGuid).toBe(PLAN_GUID);
      expect(data.plans[0].activeSubscribers).toBe(12);
      expect(data.plans[0].grandfatheredSubscribers).toBe(3);
      expect(data.plans[0].paidRevenueIsk).toBe(588000);
      expect(data.recentPlanChanges).toBe(4);
      expect(data.plans[0]).not.toHaveProperty('id');
    });

    test('returns an empty plans list when there is no subscription data', async () => {
      const emptySummary = { fromDate: '2026-04-03T00:00:00Z', plans: [], recentPlanChanges: 0 };
      const response = await call(
        'UteamupPlanAnalyticsSummary',
        {},
        successReply(emptySummary),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.plans).toEqual([]);
      expect(data.recentPlanChanges).toBe(0);
    });

    test('forwards the fromDate argument verbatim to the backend', async () => {
      const FROM_DATE = '2026-01-01T00:00:00Z';
      nock(BASE_URL)
        .post('/mcp', body =>
          body.method === 'tools/call' &&
          body.params?.name === 'UteamupPlanAnalyticsSummary' &&
          body.params?.arguments?.fromDate === FROM_DATE)
        .reply(200, JSON.stringify(successReply(mockSummary).body), {
          'Content-Type': 'application/json',
        });

      const response = await rawCall('UteamupPlanAnalyticsSummary', { fromDate: FROM_DATE }, 7103);
      expect(response.status).toBe(200);
    });

    test('omitting fromDate leaves the 90-day default to the backend', async () => {
      nock(BASE_URL)
        .post('/mcp', body =>
          body.method === 'tools/call' &&
          body.params?.name === 'UteamupPlanAnalyticsSummary' &&
          !('fromDate' in (body.params?.arguments ?? {})))
        .reply(200, JSON.stringify(successReply(mockSummary).body), {
          'Content-Type': 'application/json',
        });

      const response = await rawCall('UteamupPlanAnalyticsSummary', {}, 7104);
      expect(response.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupPlanApprovalsPending
  // ---------------------------------------------------------------------------
  describe('UteamupPlanApprovalsPending tool', () => {
    test('returns pending plan change requests with GUID identity', async () => {
      const response = await call(
        'UteamupPlanApprovalsPending',
        {},
        successReply(mockPending),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(1);
      expect(data[0].status).toBe('Pending');
      expect(data[0].guid).toBe('55555555-5555-5555-5555-555555555555');
      expect(data[0].planGuid).toBe(PLAN_GUID);
      expect(data[0].requestedByUserGuid).toBe('99999999-9999-9999-9999-999999999999');
      expect(data[0]).not.toHaveProperty('id');
    });

    test('returns empty list when nothing is awaiting approval', async () => {
      const response = await call(
        'UteamupPlanApprovalsPending',
        {},
        successReply([]),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupTenantFeatureOverridesGet
  // ---------------------------------------------------------------------------
  describe('UteamupTenantFeatureOverridesGet tool', () => {
    test('returns the tenant feature overrides', async () => {
      const response = await call(
        'UteamupTenantFeatureOverridesGet',
        { tenantGuid: TENANT_GUID },
        successReply(mockOverrides),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(1);
      expect(data[0].featureName).toBe('IndustryCoding');
      expect(data[0].mode).toBe('Grant');
      expect(data[0].tenantGuid).toBe(TENANT_GUID);
      expect(data[0].featureCatalogGuid).toBe('77777777-7777-7777-7777-777777777777');
      expect(data[0]).not.toHaveProperty('id');
    });

    test('forwards the tenantGuid argument verbatim to the backend', async () => {
      nock(BASE_URL)
        .post('/mcp', body =>
          body.method === 'tools/call' &&
          body.params?.name === 'UteamupTenantFeatureOverridesGet' &&
          body.params?.arguments?.tenantGuid === TENANT_GUID)
        .reply(200, JSON.stringify(successReply(mockOverrides).body), {
          'Content-Type': 'application/json',
        });

      const response = await rawCall('UteamupTenantFeatureOverridesGet', { tenantGuid: TENANT_GUID }, 7105);
      expect(response.status).toBe(200);
    });

    test('returns empty list when the tenant has no overrides', async () => {
      const response = await call(
        'UteamupTenantFeatureOverridesGet',
        { tenantGuid: TENANT_GUID },
        successReply([]),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Reusable error suites (JSON-RPC compliance, 401, 503)
  // ---------------------------------------------------------------------------
  const tools = [
    { name: 'UteamupPlanLimitsGet', args: { planGuid: PLAN_GUID } },
    { name: 'UteamupPricingRulesList', args: {} },
    { name: 'UteamupPlanAnalyticsSummary', args: {} },
    { name: 'UteamupPlanApprovalsPending', args: {} },
    { name: 'UteamupTenantFeatureOverridesGet', args: { tenantGuid: TENANT_GUID } },
  ];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
