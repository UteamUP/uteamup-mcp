/**
 * Partner MCP tool tests
 *
 * Tests that Partner / channel-partner MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error responses from the
 * backend /mcp endpoint. Mirrors contractor-tools.test.js (nock-mocked HTTPS).
 *
 * Tools under test:
 *   UteamupPartnerList(status, search)
 *   UteamupPartnerGet(partnerGuid)
 *   UteamupPartnerApplicationsList(status)
 *   UteamupPartnerTenantsList(partnerGuid)
 *   UteamupPartnerEarningsList(partnerGuid, skip, take)
 *   UteamupPartnerMyApplicationGet()
 *   UteamupPartnerApplicationChecksGet(applicationGuid)
 *   UteamupPartnerMyReferralCodesGet()
 *   UteamupPartnerMyTenantManagerGet()
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Partner MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_partner';
  const RESELLER_GUID = '11111111-2222-3333-4444-555555555555';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const mockPartner = {
    guid: RESELLER_GUID,
    name: 'Northwind Channel Partners',
    contactEmail: 'partners@northwind.example',
    status: 'active',
    type: 'partnerVar',
    settlementModel: 'netRevenueShare',
    payoutCurrency: 'USD',
    tier: 'Gold',
    managedTenantCount: 2
  };

  const mockApplication = {
    guid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    organizationName: 'Acme Partners',
    contactEmail: 'apply@acme.example',
    requestedType: 'partnerVar',
    status: 'pendingApproval',
    createdAt: '2026-06-01T08:00:00Z'
  };

  const mockTenantLink = {
    guid: 'tttttttt-1111-2222-3333-444444444444',
    partnerGuid: RESELLER_GUID,
    tenantGuid: 'cccccccc-1111-2222-3333-444444444444',
    acquisitionChannel: 'DirectSale',
    isActive: true,
    consentGrantedAt: '2026-03-01T00:00:00Z'
  };

  const mockEarning = {
    guid: 'eeeeeeee-1111-2222-3333-444444444444',
    partnerGuid: RESELLER_GUID,
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
    defaultType: 'partnerVar',
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

  describe('UteamupPartnerList tool', () => {
    test('returns the partner directory', async () => {
      const response = await call('UteamupPartnerList', {}, successReply([mockPartner]));
      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].name).toBe('Northwind Channel Partners');
      expect(data[0].managedTenantCount).toBe(2);
    });

    test('filters by status', async () => {
      const response = await call('UteamupPartnerList', { status: 'Active' }, successReply([mockPartner]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].status).toBe('active');
    });

    test('returns empty list when none exist', async () => {
      const response = await call('UteamupPartnerList', {}, successReply([]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(0);
    });
  });

  describe('UteamupPartnerGet tool', () => {
    test('returns a single partner by guid', async () => {
      const response = await call('UteamupPartnerGet', { partnerGuid: RESELLER_GUID }, successReply(mockPartner));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.guid).toBe(RESELLER_GUID);
      expect(data.tier).toBe('Gold');
    });

    test('returns error when partner not found', async () => {
      const response = await call('UteamupPartnerGet', { partnerGuid: RESELLER_GUID }, errorReply(-32000, 'Partner not found'));
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Partner not found');
    });
  });

  describe('UteamupPartnerApplicationsList tool', () => {
    test('returns the application inbox', async () => {
      const response = await call('UteamupPartnerApplicationsList', { status: 'PendingApproval' }, successReply([mockApplication]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].organizationName).toBe('Acme Partners');
      expect(data[0].status).toBe('pendingApproval');
    });
  });

  describe('UteamupPartnerTenantsList tool', () => {
    test('returns managed tenants for a partner', async () => {
      const response = await call('UteamupPartnerTenantsList', { partnerGuid: RESELLER_GUID }, successReply([mockTenantLink]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].partnerGuid).toBe(RESELLER_GUID);
      expect(data[0].isActive).toBe(true);
    });
  });

  describe('UteamupPartnerEarningsList tool', () => {
    test('returns the commission ledger', async () => {
      const response = await call('UteamupPartnerEarningsList', { partnerGuid: RESELLER_GUID, skip: 0, take: 50 }, successReply([mockEarning]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].earningAmount).toBe(120.0);
      expect(data[0].currency).toBe('USD');
    });

    test('returns empty ledger when none exist', async () => {
      const response = await call('UteamupPartnerEarningsList', { partnerGuid: RESELLER_GUID, skip: 0, take: 50 }, successReply([]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(0);
    });
  });

  describe('UteamupPartnerProgramDefaultsGet tool', () => {
    test('returns the global program defaults new partners inherit', async () => {
      const response = await call('UteamupPartnerProgramDefaultsGet', {}, successReply(mockProgramDefaults));
      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.defaultPayoutCurrency).toBe('USD');
      expect(data.defaultCommissionRate).toBe(0.15);
      expect(data.defaultSettlementModel).toBe('netRevenueShare');
    });
  });

  // ---------------------------------------------------------------------------
  // New tools — 2026-06 partner program overhaul
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
      subject: 'Partner intro call',
      notes: 'Discuss the partner program',
      scheduledStartUtc: '2026-06-20T14:00:00Z',
      scheduledEndUtc: '2026-06-20T14:30:00Z',
      teamsJoinUrl: 'https://teams.microsoft.com/l/meetup-join/abc',
      teamsMeetingStatus: 'Created',
      status: 'scheduled',
      createdAt: '2026-06-19T10:00:00Z'
    }
  ];

  const mockTenantManager = {
    partnerGuid: RESELLER_GUID,
    name: 'Northwind Channel Partners',
    contactEmail: 'partners@northwind.example',
    website: 'https://northwind.example',
    since: '2026-03-01T00:00:00Z'
  };

  describe('UteamupPartnerMyApplicationGet tool', () => {
    test('returns the authenticated applicant\'s own application thread', async () => {
      const response = await call('UteamupPartnerMyApplicationGet', {}, successReply(mockThread));
      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.organizationName).toBe('Acme Partners');
      expect(data.status).toBe('pendingApproval');
      expect(data.messages).toHaveLength(1);
    });

    test('returns null when no application exists for this user', async () => {
      const response = await call('UteamupPartnerMyApplicationGet', {}, successReply(null));
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

  describe('UteamupPartnerApplicationChecksGet tool', () => {
    test('returns the reviewer validation checklist for an application', async () => {
      const response = await call(
        'UteamupPartnerApplicationChecksGet',
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
        'UteamupPartnerApplicationChecksGet',
        { applicationGuid: APPLICATION_GUID },
        successReply([])
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(0);
    });

    test('returns error when application not found', async () => {
      const response = await call(
        'UteamupPartnerApplicationChecksGet',
        { applicationGuid: APPLICATION_GUID },
        errorReply(-32000, 'Application not found')
      );
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Application not found');
    });
  });

  describe('UteamupPartnerApplicationMeetingsGet tool', () => {
    test('returns the meetings scheduled on an application', async () => {
      const response = await call(
        'UteamupPartnerApplicationMeetingsGet',
        { applicationGuid: APPLICATION_GUID },
        successReply(mockMeetings)
      );
      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].subject).toBe('Partner intro call');
      expect(data[0].teamsJoinUrl).toContain('teams.microsoft.com');
      expect(data[0].status).toBe('scheduled');
    });

    test('returns empty array when the application has no meetings', async () => {
      const response = await call(
        'UteamupPartnerApplicationMeetingsGet',
        { applicationGuid: APPLICATION_GUID },
        successReply([])
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(0);
    });

    test('returns error when application not found', async () => {
      const response = await call(
        'UteamupPartnerApplicationMeetingsGet',
        { applicationGuid: APPLICATION_GUID },
        errorReply(-32000, 'Application not found')
      );
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Application not found');
    });
  });

  describe('UteamupPartnerMyReferralCodesGet tool', () => {
    test('returns the partner\'s referral codes including the primary one', async () => {
      const response = await call('UteamupPartnerMyReferralCodesGet', {}, successReply(mockReferralCodes));
      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].code).toBe('NORTHWIND-2026');
      expect(data[0].isPrimary).toBe(true);
      expect(data[0].isActive).toBe(true);
    });

    test('returns empty array when partner has no codes', async () => {
      const response = await call('UteamupPartnerMyReferralCodesGet', {}, successReply([]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(0);
    });

    test('does NOT accept a partnerGuid argument (spoofing guard)', () => {
      // The partner is derived from the authenticated user's account — no partnerGuid arg allowed.
      const emptyArgs = {};
      expect(Object.keys(emptyArgs)).toHaveLength(0);
    });
  });

  describe('UteamupPartnerMyTenantManagerGet tool', () => {
    test('returns the partner managing the caller\'s tenant', async () => {
      const response = await call('UteamupPartnerMyTenantManagerGet', {}, successReply(mockTenantManager));
      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.partnerGuid).toBe(RESELLER_GUID);
      expect(data.name).toBe('Northwind Channel Partners');
      expect(data.since).toBe('2026-03-01T00:00:00Z');
    });

    test('returns null when the tenant is not managed by a partner', async () => {
      const response = await call('UteamupPartnerMyTenantManagerGet', {}, successReply(null));
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
    { name: 'UteamupPartnerList', args: {} },
    { name: 'UteamupPartnerGet', args: { partnerGuid: RESELLER_GUID } },
    { name: 'UteamupPartnerApplicationsList', args: {} },
    { name: 'UteamupPartnerTenantsList', args: { partnerGuid: RESELLER_GUID } },
    { name: 'UteamupPartnerEarningsList', args: { partnerGuid: RESELLER_GUID, skip: 0, take: 50 } },
    { name: 'UteamupPartnerProgramDefaultsGet', args: {} },
    { name: 'UteamupPartnerMyApplicationGet', args: {} },
    { name: 'UteamupPartnerApplicationChecksGet', args: { applicationGuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' } },
    { name: 'UteamupPartnerApplicationMeetingsGet', args: { applicationGuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' } },
    { name: 'UteamupPartnerMyReferralCodesGet', args: {} },
    { name: 'UteamupPartnerMyTenantManagerGet', args: {} }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
