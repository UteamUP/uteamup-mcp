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
  // Shared error-handling tests (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupResellerList', args: {} },
    { name: 'UteamupResellerGet', args: { resellerGuid: RESELLER_GUID } },
    { name: 'UteamupResellerApplicationsList', args: {} },
    { name: 'UteamupResellerTenantsList', args: { resellerGuid: RESELLER_GUID } },
    { name: 'UteamupResellerEarningsList', args: { resellerGuid: RESELLER_GUID, skip: 0, take: 50 } },
    { name: 'UteamupResellerProgramDefaultsGet', args: {} }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
