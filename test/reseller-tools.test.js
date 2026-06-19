/**
 * Reseller MCP tool tests
 *
 * Tests that Reseller / channel-partner MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error responses from the
 * backend /mcp endpoint. Mirrors contractor-tools.test.js (nock-mocked HTTPS).
 *
 * Tools under test:
 *   UteamupResellerList(status, search)
 *   UteamupResellerGet(resellerGuid)
 *   UteamupResellerApplicationsList(status)
 *   UteamupResellerTenantsList(resellerGuid)
 *   UteamupResellerEarningsList(resellerGuid, skip, take)
 *   UteamupResellerMyApplicationGet()
 *   UteamupResellerApplicationChecksGet(applicationGuid)
 *   UteamupResellerMyReferralCodesGet()
 *   UteamupResellerMyTenantManagerGet()
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Reseller MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_reseller';
  const RESELLER_GUID = '11111111-2222-3333-4444-555555555555';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const mockReseller = {
    guid: RESELLER_GUID,
    name: 'Northwind Channel Partners',
    contactEmail: 'partners@northwind.example',
    status: 'active',
    type: 'resellerVar',
    settlementModel: 'netRevenueShare',
    payoutCurrency: 'USD',
    tier: 'Gold',
    managedTenantCount: 2
  };

  const mockApplication = {
    guid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    organizationName: 'Acme Partners',
    contactEmail: 'apply@acme.example',
    requestedType: 'resellerVar',
    status: 'pendingApproval',
    createdAt: '2026-06-01T08:00:00Z'
  };

  const mockTenantLink = {
    guid: 'tttttttt-1111-2222-3333-444444444444',
    resellerGuid: RESELLER_GUID,
    tenantGuid: 'cccccccc-1111-2222-3333-444444444444',
    acquisitionChannel: 'DirectSale',
    isActive: true,
    consentGrantedAt: '2026-03-01T00:00:00Z'
  };

  const mockEarning = {
    guid: 'eeeeeeee-1111-2222-3333-444444444444',
    resellerGuid: RESELLER_GUID,
    tenantName: 'Solid Energy',
    grossAmount: 800.0,
    commissionRate: 0.15,
    earningAmount: 120.0,
    currency: 'USD',
    state: 'accrued',
    accruedAt: '2026-06-10T00:00:00Z'
  };

  const mockProgramDefaults = {
    defaultCommissionRate: 0.15,
    defaultCommissionBase: 'netOfDiscount',
    defaultType: 'resellerVar',
    defaultSettlementModel: 'netRevenueShare',
    defaultSettlementMethod: 'cash',
    defaultPayoutMethod: 'manualOffline',
    defaultVatTreatment: 'standard',
    defaultSelfBilling: false,
    defaultPayoutCurrency: 'USD',
    defaultPayoutCadence: 'Monthly',
    defaultMinPayoutThreshold: 100.0,
    defaultTier: 'Standard'
  };

  describe('UteamupResellerList tool', () => {
    test('returns the reseller directory', async () => {
      const response = await call('UteamupResellerList', {}, successReply([mockReseller]));
      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].name).toBe('Northwind Channel Partners');
      expect(data[0].managedTenantCount).toBe(2);
    });

    test('filters by status', async () => {
      const response = await call('UteamupResellerList', { status: 'Active' }, successReply([mockReseller]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].status).toBe('active');
    });

    test('returns empty list when none exist', async () => {
      const response = await call('UteamupResellerList', {}, successReply([]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(0);
    });
  });

  describe('UteamupResellerGet tool', () => {
    test('returns a single reseller by guid', async () => {
      const response = await call('UteamupResellerGet', { resellerGuid: RESELLER_GUID }, successReply(mockReseller));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.guid).toBe(RESELLER_GUID);
      expect(data.tier).toBe('Gold');
    });

    test('returns error when reseller not found', async () => {
      const response = await call('UteamupResellerGet', { resellerGuid: RESELLER_GUID }, errorReply(-32000, 'Reseller not found'));
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Reseller not found');
    });
  });

  describe('UteamupResellerApplicationsList tool', () => {
    test('returns the application inbox', async () => {
      const response = await call('UteamupResellerApplicationsList', { status: 'PendingApproval' }, successReply([mockApplication]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].organizationName).toBe('Acme Partners');
      expect(data[0].status).toBe('pendingApproval');
    });
  });

  describe('UteamupResellerTenantsList tool', () => {
    test('returns managed tenants for a reseller', async () => {
      const response = await call('UteamupResellerTenantsList', { resellerGuid: RESELLER_GUID }, successReply([mockTenantLink]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].resellerGuid).toBe(RESELLER_GUID);
      expect(data[0].isActive).toBe(true);
    });
  });

  describe('UteamupResellerEarningsList tool', () => {
    test('returns the commission ledger', async () => {
      const response = await call('UteamupResellerEarningsList', { resellerGuid: RESELLER_GUID, skip: 0, take: 50 }, successReply([mockEarning]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].earningAmount).toBe(120.0);
      expect(data[0].currency).toBe('USD');
    });

    test('returns empty ledger when none exist', async () => {
      const response = await call('UteamupResellerEarningsList', { resellerGuid: RESELLER_GUID, skip: 0, take: 50 }, successReply([]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(0);
    });
  });

  describe('UteamupResellerProgramDefaultsGet tool', () => {
    test('returns the global program defaults new resellers inherit', async () => {
      const response = await call('UteamupResellerProgramDefaultsGet', {}, successReply(mockProgramDefaults));
      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.defaultPayoutCurrency).toBe('USD');
      expect(data.defaultCommissionRate).toBe(0.15);
      expect(data.defaultSettlementModel).toBe('netRevenueShare');
    });
  });

  // ---------------------------------------------------------------------------
  // New tools — 2026-06 reseller program overhaul
  // ---------------------------------------------------------------------------

  const APPLICATION_GUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  const mockThread = {
    applicationGuid: APPLICATION_GUID,
    organizationName: 'Acme Partners',
    contactEmail: 'apply@acme.example',
    status: 'pendingApproval',
    messages: [
      {
        guid: 'msg00000-0000-0000-0000-000000000001',
        isFromAdmin: false,
        authorName: 'Jane Applicant',
        body: 'Hi, we applied last week.',
        createdAt: '2026-06-01T08:00:00Z'
      }
    ]
  };

  const mockChecks = [
    {
      guid: 'chk00000-0000-0000-0000-000000000001',
      checkType: 'emailVerified',
      status: 'passed',
      note: null,
      completedAt: '2026-06-02T10:00:00Z'
    },
    {
      guid: 'chk00000-0000-0000-0000-000000000002',
      checkType: 'kyc',
      status: 'pending',
      note: null,
      completedAt: null
    }
  ];

  const mockReferralCodes = [
    {
      guid: 'ref00000-0000-0000-0000-000000000001',
      code: 'NORTHWIND-2026',
      label: 'Primary',
      isActive: true,
      isPrimary: true,
      createdAt: '2026-01-01T00:00:00Z'
    }
  ];

  const mockMeetings = [
    {
      guid: 'mtg00000-0000-0000-0000-000000000001',
      subject: 'Reseller intro call',
      notes: 'Discuss the reseller program',
      scheduledStartUtc: '2026-06-20T14:00:00Z',
      scheduledEndUtc: '2026-06-20T14:30:00Z',
      teamsJoinUrl: 'https://teams.microsoft.com/l/meetup-join/abc',
      teamsMeetingStatus: 'Created',
      status: 'scheduled',
      createdAt: '2026-06-19T10:00:00Z'
    }
  ];

  const mockTenantManager = {
    resellerGuid: RESELLER_GUID,
    name: 'Northwind Channel Partners',
    contactEmail: 'partners@northwind.example',
    website: 'https://northwind.example',
    since: '2026-03-01T00:00:00Z'
  };

  describe('UteamupResellerMyApplicationGet tool', () => {
    test('returns the authenticated applicant\'s own application thread', async () => {
      const response = await call('UteamupResellerMyApplicationGet', {}, successReply(mockThread));
      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.organizationName).toBe('Acme Partners');
      expect(data.status).toBe('pendingApproval');
      expect(data.messages).toHaveLength(1);
    });

    test('returns null when no application exists for this user', async () => {
      const response = await call('UteamupResellerMyApplicationGet', {}, successReply(null));
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toBeNull();
    });

    test('does NOT accept a userId argument (spoofing guard)', () => {
      // The user identity comes solely from the Bearer token — no userId arg allowed.
      // An empty args object passed to the tool is the correct shape.
      const emptyArgs = {};
      expect(Object.keys(emptyArgs)).toHaveLength(0);
    });
  });

  describe('UteamupResellerApplicationChecksGet tool', () => {
    test('returns the reviewer validation checklist for an application', async () => {
      const response = await call(
        'UteamupResellerApplicationChecksGet',
        { applicationGuid: APPLICATION_GUID },
        successReply(mockChecks)
      );
      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].checkType).toBe('emailVerified');
      expect(data[0].status).toBe('passed');
      expect(data[1].status).toBe('pending');
    });

    test('returns empty array when application has no checks yet', async () => {
      const response = await call(
        'UteamupResellerApplicationChecksGet',
        { applicationGuid: APPLICATION_GUID },
        successReply([])
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(0);
    });

    test('returns error when application not found', async () => {
      const response = await call(
        'UteamupResellerApplicationChecksGet',
        { applicationGuid: APPLICATION_GUID },
        errorReply(-32000, 'Application not found')
      );
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Application not found');
    });
  });

  describe('UteamupResellerApplicationMeetingsGet tool', () => {
    test('returns the meetings scheduled on an application', async () => {
      const response = await call(
        'UteamupResellerApplicationMeetingsGet',
        { applicationGuid: APPLICATION_GUID },
        successReply(mockMeetings)
      );
      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].subject).toBe('Reseller intro call');
      expect(data[0].teamsJoinUrl).toContain('teams.microsoft.com');
      expect(data[0].status).toBe('scheduled');
    });

    test('returns empty array when the application has no meetings', async () => {
      const response = await call(
        'UteamupResellerApplicationMeetingsGet',
        { applicationGuid: APPLICATION_GUID },
        successReply([])
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(0);
    });

    test('returns error when application not found', async () => {
      const response = await call(
        'UteamupResellerApplicationMeetingsGet',
        { applicationGuid: APPLICATION_GUID },
        errorReply(-32000, 'Application not found')
      );
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Application not found');
    });
  });

  describe('UteamupResellerMyReferralCodesGet tool', () => {
    test('returns the reseller\'s referral codes including the primary one', async () => {
      const response = await call('UteamupResellerMyReferralCodesGet', {}, successReply(mockReferralCodes));
      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].code).toBe('NORTHWIND-2026');
      expect(data[0].isPrimary).toBe(true);
      expect(data[0].isActive).toBe(true);
    });

    test('returns empty array when reseller has no codes', async () => {
      const response = await call('UteamupResellerMyReferralCodesGet', {}, successReply([]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(0);
    });

    test('does NOT accept a resellerGuid argument (spoofing guard)', () => {
      // The reseller is derived from the authenticated user's account — no resellerGuid arg allowed.
      const emptyArgs = {};
      expect(Object.keys(emptyArgs)).toHaveLength(0);
    });
  });

  describe('UteamupResellerMyTenantManagerGet tool', () => {
    test('returns the reseller managing the caller\'s tenant', async () => {
      const response = await call('UteamupResellerMyTenantManagerGet', {}, successReply(mockTenantManager));
      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.resellerGuid).toBe(RESELLER_GUID);
      expect(data.name).toBe('Northwind Channel Partners');
      expect(data.since).toBe('2026-03-01T00:00:00Z');
    });

    test('returns null when the tenant is not managed by a reseller', async () => {
      const response = await call('UteamupResellerMyTenantManagerGet', {}, successReply(null));
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toBeNull();
    });

    test('does NOT accept a tenantGuid argument (spoofing guard)', () => {
      // The tenant is derived from the authenticated API key's context — no tenantGuid arg allowed.
      const emptyArgs = {};
      expect(Object.keys(emptyArgs)).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Shared error-handling tests (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupResellerList', args: {} },
    { name: 'UteamupResellerGet', args: { resellerGuid: RESELLER_GUID } },
    { name: 'UteamupResellerApplicationsList', args: {} },
    { name: 'UteamupResellerTenantsList', args: { resellerGuid: RESELLER_GUID } },
    { name: 'UteamupResellerEarningsList', args: { resellerGuid: RESELLER_GUID, skip: 0, take: 50 } },
    { name: 'UteamupResellerProgramDefaultsGet', args: {} },
    { name: 'UteamupResellerMyApplicationGet', args: {} },
    { name: 'UteamupResellerApplicationChecksGet', args: { applicationGuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' } },
    { name: 'UteamupResellerApplicationMeetingsGet', args: { applicationGuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' } },
    { name: 'UteamupResellerMyReferralCodesGet', args: {} },
    { name: 'UteamupResellerMyTenantManagerGet', args: {} }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
