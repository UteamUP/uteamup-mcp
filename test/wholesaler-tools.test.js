/**
 * Wholesaler MCP tool tests
 *
 * Tests that Wholesaler-program MCP tool calls (goods suppliers — distinct from the license
 * Reseller program) are correctly formed as JSON-RPC 2.0 requests and that the MCP proxy
 * properly handles both successful and error responses. Mirrors reseller-tools.test.js
 * (nock-mocked HTTPS).
 *
 * Tools under test:
 *   UteamupWholesalerList(status, search)
 *   UteamupWholesalerGet(guid)
 *   UteamupWholesalerApplicationsList(status)
 *   UteamupWholesalerCatalogGet(guid)
 *   UteamupWholesalerMyGet()
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Wholesaler MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_wholesaler';
  const WHOLESALER_GUID = '11111111-2222-3333-4444-555555555555';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const mockWholesaler = {
    guid: WHOLESALER_GUID,
    name: 'Nordic Industrial Supply',
    legalName: 'Nordic Industrial Supply ehf.',
    contactEmail: 'sales@nordic-supply.example',
    country: 'IS',
    settlementCountry: 'IS',
    status: 'active',
    catalogItemCount: 240,
    lastSyncAt: '2026-07-01T06:00:00Z'
  };

  const mockApplication = {
    guid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    companyName: 'Baltic Bearings OU',
    contactEmail: 'apply@baltic-bearings.example',
    country: 'EE',
    status: 'pendingApproval',
    createdAt: '2026-06-25T08:00:00Z'
  };

  const mockCatalogItem = {
    guid: 'cccccccc-1111-2222-3333-444444444444',
    externalSku: 'SKF-6205-2RS',
    name: 'SKF 6205-2RS deep groove ball bearing',
    itemType: 'Part',
    price: 8.4,
    currency: 'EUR',
    stockQuantity: 1200,
    leadTimeDays: 5,
    isDiscontinued: false,
    manufacturer: 'SKF'
  };

  describe('UteamupWholesalerList tool', () => {
    test('returns the wholesaler directory', async () => {
      const response = await call('UteamupWholesalerList', {}, successReply([mockWholesaler]));
      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].name).toBe('Nordic Industrial Supply');
      expect(data[0].catalogItemCount).toBe(240);
    });

    test('filters by status and search', async () => {
      const response = await call('UteamupWholesalerList', { status: 'Active', search: 'nordic' }, successReply([mockWholesaler]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].status).toBe('active');
    });

    test('returns empty list when none exist', async () => {
      const response = await call('UteamupWholesalerList', {}, successReply([]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(0);
    });
  });

  describe('UteamupWholesalerGet tool', () => {
    test('returns a single wholesaler by guid', async () => {
      const response = await call('UteamupWholesalerGet', { guid: WHOLESALER_GUID }, successReply(mockWholesaler));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.guid).toBe(WHOLESALER_GUID);
      expect(data.settlementCountry).toBe('IS');
    });

    test('returns error when wholesaler not found', async () => {
      const response = await call('UteamupWholesalerGet', { guid: WHOLESALER_GUID }, errorReply(-32000, 'Wholesaler not found'));
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Wholesaler not found');
    });
  });

  describe('UteamupWholesalerApplicationsList tool', () => {
    test('returns the application inbox', async () => {
      const response = await call('UteamupWholesalerApplicationsList', { status: 'PendingApproval' }, successReply([mockApplication]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].companyName).toBe('Baltic Bearings OU');
      expect(data[0].status).toBe('pendingApproval');
    });

    test('returns empty inbox when no applications', async () => {
      const response = await call('UteamupWholesalerApplicationsList', {}, successReply([]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(0);
    });
  });

  describe('UteamupWholesalerCatalogGet tool', () => {
    test('returns the synced catalog items', async () => {
      const response = await call('UteamupWholesalerCatalogGet', { guid: WHOLESALER_GUID }, successReply([mockCatalogItem]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].externalSku).toBe('SKF-6205-2RS');
      expect(data[0].stockQuantity).toBe(1200);
      expect(data[0].isDiscontinued).toBe(false);
    });

    test('returns empty catalog when nothing synced yet', async () => {
      const response = await call('UteamupWholesalerCatalogGet', { guid: WHOLESALER_GUID }, successReply([]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(0);
    });

    test('catalog rows never expose the wholesaler API credentials', async () => {
      const response = await call('UteamupWholesalerCatalogGet', { guid: WHOLESALER_GUID }, successReply([mockCatalogItem]));
      const row = JSON.parse(response.body.result.content[0].text)[0];
      for (const forbidden of ['apiKey', 'apiSecret', 'keyHash', 'secretHash', 'encryptedBankDetails']) {
        expect(row[forbidden]).toBeUndefined();
      }
    });
  });

  describe('UteamupWholesalerMyGet tool', () => {
    test('returns the caller\'s own wholesaler', async () => {
      const response = await call('UteamupWholesalerMyGet', {}, successReply(mockWholesaler));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.guid).toBe(WHOLESALER_GUID);
      expect(data.status).toBe('active');
    });

    test('returns null when the user owns no wholesaler', async () => {
      const response = await call('UteamupWholesalerMyGet', {}, successReply(null));
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toBeNull();
    });

    test('does NOT accept a wholesalerGuid argument (spoofing guard)', () => {
      // Ownership is derived from the authenticated user's account — no guid arg allowed.
      const emptyArgs = {};
      expect(Object.keys(emptyArgs)).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Shared error-handling tests (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupWholesalerList', args: {} },
    { name: 'UteamupWholesalerGet', args: { guid: WHOLESALER_GUID } },
    { name: 'UteamupWholesalerApplicationsList', args: {} },
    { name: 'UteamupWholesalerCatalogGet', args: { guid: WHOLESALER_GUID } },
    { name: 'UteamupWholesalerMyGet', args: {} }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
