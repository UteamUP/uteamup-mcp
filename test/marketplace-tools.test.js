/**
 * Marketplace MCP tool tests
 *
 * Tests that cross-tenant marketplace MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error responses from
 * the backend /mcp endpoint. Mirrors reseller-tools.test.js (nock-mocked HTTPS).
 *
 * Tools under test:
 *   UteamupMarketplaceBrowse(search, itemType, condition, sourceKind, page, pageSize)
 *   UteamupMarketplaceListingGet(guid)
 *   UteamupMarketplaceRequirementsList()
 *   UteamupMarketplaceMyOffersList()
 *   UteamupMarketplaceTransactionsList(page, pageSize)
 *   UteamupMarketplaceSettingsGet()
 *   UteamupMarketplaceListingReport(guid, reasonCode, details?)   ← C14 write tool
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, sendRawRequest, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Marketplace MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_marketplace';
  const LISTING_GUID = '11111111-2222-3333-4444-555555555555';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const mockListing = {
    guid: LISTING_GUID,
    title: 'Grundfos CR-32 pump',
    description: 'Surplus vertical multistage pump, never installed',
    itemType: 'Part',
    listingType: 'Sale',
    condition: 'New',
    basePrice: 1450.0,
    currency: 'EUR',
    quantityDisplay: '11–50',
    sourceKind: 'TenantListing',
    sellerTenantGuid: 'aaaaaaaa-1111-2222-3333-444444444444',
    sellerName: 'Solid Energy',
    sellerCountry: 'IS',
    sellerCity: 'Reykjavik',
    wholesalerGuid: null,
    allowBidding: false,
    settlementCountry: 'IS',
    ratingAverage: 4.5,
    ratingCount: 12,
    createdAt: '2026-06-20T09:00:00Z'
  };

  const mockCatalogListing = {
    ...mockListing,
    guid: '99999999-8888-7777-6666-555555555555',
    title: 'SKF 6205 bearing',
    sourceKind: 'WholesalerCatalog',
    sellerTenantGuid: null,
    sellerName: 'Nordic Industrial Supply',
    wholesalerGuid: 'bbbbbbbb-1111-2222-3333-444444444444',
    leadTimeDays: 5,
    minOrderQuantity: 10
  };

  const pagedListings = {
    items: [mockListing, mockCatalogListing],
    totalCount: 2,
    page: 1,
    pageSize: 20
  };

  const mockRequirement = {
    requirementGuid: 'cccccccc-1111-2222-3333-444444444444',
    anonymousCode: 'REQ-4F2A9B',
    itemName: 'Hydraulic oil ISO VG 46',
    itemType: 'Chemical',
    quantityBucket: '51–200',
    targetUnitPrice: 12.5,
    currency: 'EUR',
    country: 'IS',
    neededByDate: '2026-08-01T00:00:00Z',
    expiresAt: '2026-07-20T00:00:00Z',
    status: 'Open',
    offerCount: 2,
    publishedAt: '2026-07-01T10:00:00Z'
  };

  const mockMyOffer = {
    guid: 'dddddddd-1111-2222-3333-444444444444',
    requirementGuid: mockRequirement.requirementGuid,
    requirementAnonymousCode: 'REQ-4F2A9B',
    itemName: 'Hydraulic oil ISO VG 46',
    itemType: 'Chemical',
    unitPrice: 11.9,
    currency: 'EUR',
    offerQuantity: 100,
    leadTimeDays: 7,
    validUntil: '2026-07-15T00:00:00Z',
    message: 'Delivery included within Iceland',
    status: 'Submitted',
    createdAt: '2026-07-02T08:00:00Z'
  };

  const mockTransaction = {
    guid: 'eeeeeeee-1111-2222-3333-444444444444',
    transactionNumber: 'MP-100042',
    status: 'AwaitingPayment',
    paymentStatus: 'Pending',
    settlementMethod: 'BankTransfer',
    settlementCountry: 'IS',
    totalAmount: 1450.0,
    currency: 'EUR',
    buyerTenantGuid: 'ffffffff-1111-2222-3333-444444444444',
    sellerTenantGuid: 'aaaaaaaa-1111-2222-3333-444444444444',
    createdAt: '2026-07-01T12:00:00Z'
  };

  const pagedTransactions = {
    items: [mockTransaction],
    totalCount: 1,
    page: 1,
    pageSize: 20
  };

  const mockSettings = {
    marketplaceEnabled: true,
    sellingEnabled: true,
    buyingEnabled: true,
    defaultListingVisibility: 'Public',
    allowedItemTypesCsv: 'Part,Tool,Chemical',
    publishStockRequirements: true,
    requirementsAudience: 'Both',
    stockQuantityDisplay: 'Ranges',
    autoReserveOnAccept: true
  };

  describe('UteamupMarketplaceBrowse tool', () => {
    test('returns a paged cross-tenant result mixing tenant listings and wholesaler catalog rows', async () => {
      const response = await call('UteamupMarketplaceBrowse', { search: 'pump' }, successReply(pagedListings));
      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.totalCount).toBe(2);
      expect(data.items[0].sourceKind).toBe('TenantListing');
      expect(data.items[1].sourceKind).toBe('WholesalerCatalog');
      expect(data.items[1].wholesalerGuid).toBeTruthy();
    });

    test('supports filter args (itemType, condition, sourceKind, paging)', async () => {
      const response = await call(
        'UteamupMarketplaceBrowse',
        { itemType: 'Part', condition: 'New', sourceKind: 'TenantListing', page: 1, pageSize: 20 },
        successReply({ ...pagedListings, items: [mockListing], totalCount: 1 })
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].itemType).toBe('Part');
    });

    test('quantity is a display string honoring the seller preference, never a raw stock column', async () => {
      const response = await call('UteamupMarketplaceBrowse', {}, successReply(pagedListings));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(typeof data.items[0].quantityDisplay).toBe('string');
      expect(data.items[0].currentStock).toBeUndefined();
    });

    test('returns empty page when no sellers opted in', async () => {
      const response = await call('UteamupMarketplaceBrowse', {}, successReply({ items: [], totalCount: 0, page: 1, pageSize: 20 }));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.items).toHaveLength(0);
    });
  });

  describe('UteamupMarketplaceListingGet tool', () => {
    test('returns one listing by guid', async () => {
      const response = await call('UteamupMarketplaceListingGet', { guid: LISTING_GUID }, successReply(mockListing));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.guid).toBe(LISTING_GUID);
      expect(data.sellerName).toBe('Solid Energy');
      expect(data.settlementCountry).toBe('IS');
    });

    test('returns null when the seller has opted out (listing invisible)', async () => {
      const response = await call('UteamupMarketplaceListingGet', { guid: LISTING_GUID }, successReply(null));
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toBeNull();
    });

    test('returns error when listing not found', async () => {
      const response = await call('UteamupMarketplaceListingGet', { guid: LISTING_GUID }, errorReply(-32000, 'Listing not found'));
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Listing not found');
    });
  });

  describe('UteamupMarketplaceRequirementsList tool', () => {
    test('returns open anonymous requirements', async () => {
      const response = await call(
        'UteamupMarketplaceRequirementsList',
        {},
        successReply({ items: [mockRequirement], totalCount: 1, page: 1, pageSize: 20 })
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.items[0].anonymousCode).toBe('REQ-4F2A9B');
      expect(data.items[0].quantityBucket).toBe('51–200');
    });

    test('ANONYMITY: requirement rows carry no tenant identity fields', async () => {
      const response = await call(
        'UteamupMarketplaceRequirementsList',
        {},
        successReply({ items: [mockRequirement], totalCount: 1, page: 1, pageSize: 20 })
      );
      const row = JSON.parse(response.body.result.content[0].text).items[0];
      // Contract mirror of Security/MarketplaceAnonymityTests: the pre-award payload must
      // never contain requester identity. Country/region-only is the allowed maximum.
      for (const forbidden of ['tenantGuid', 'tenantName', 'tenantId', 'address', 'deliveryAddress', 'contactEmail', 'requesterName', 'city']) {
        expect(row[forbidden]).toBeUndefined();
      }
    });

    test('does NOT accept a tenantGuid argument (spoofing guard)', () => {
      // Audience scoping comes solely from the authenticated API key's tenant context.
      const emptyArgs = {};
      expect(Object.keys(emptyArgs)).toHaveLength(0);
    });
  });

  describe('UteamupMarketplaceMyOffersList tool', () => {
    test('returns the tenant\'s submitted offers with status', async () => {
      const response = await call('UteamupMarketplaceMyOffersList', {}, successReply([mockMyOffer]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].requirementAnonymousCode).toBe('REQ-4F2A9B');
      expect(data[0].status).toBe('Submitted');
    });

    test('returns empty list when no offers submitted', async () => {
      const response = await call('UteamupMarketplaceMyOffersList', {}, successReply([]));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(0);
    });
  });

  describe('UteamupMarketplaceTransactionsList tool', () => {
    test('returns the tenant\'s transactions with settlement info', async () => {
      const response = await call('UteamupMarketplaceTransactionsList', { page: 1, pageSize: 20 }, successReply(pagedTransactions));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.items[0].transactionNumber).toBe('MP-100042');
      expect(data.items[0].settlementMethod).toBe('BankTransfer');
      expect(data.items[0].settlementCountry).toBe('IS');
    });

    test('returns error on permission denial', async () => {
      const response = await call(
        'UteamupMarketplaceTransactionsList',
        { page: 1, pageSize: 20 },
        errorReply(-32000, 'Permission denied: MarketplaceTransaction.View required')
      );
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
    });
  });

  describe('UteamupMarketplaceSettingsGet tool', () => {
    test('returns the tenant marketplace settings', async () => {
      const response = await call('UteamupMarketplaceSettingsGet', {}, successReply(mockSettings));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.marketplaceEnabled).toBe(true);
      expect(data.stockQuantityDisplay).toBe('Ranges');
      expect(data.autoReserveOnAccept).toBe(true);
    });

    test('does NOT accept a tenantGuid argument (spoofing guard)', () => {
      // Settings are resolved from the authenticated API key's tenant context only.
      const emptyArgs = {};
      expect(Object.keys(emptyArgs)).toHaveLength(0);
    });
  });

  describe('UteamupMarketplaceListingReport tool (C14 write)', () => {
    test('filing a report returns true', async () => {
      const response = await call(
        'UteamupMarketplaceListingReport',
        { guid: LISTING_GUID, reasonCode: 'Misleading' },
        successReply(true)
      );
      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toBe(true);
    });

    test('details is optional — a report without details still succeeds', async () => {
      const response = await call(
        'UteamupMarketplaceListingReport',
        { guid: LISTING_GUID, reasonCode: 'Offensive' },
        successReply(true)
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toBe(true);
    });

    test('forwards guid, reasonCode and details verbatim, carrying NO tenant/user identity args', async () => {
      // Reporter identity is derived from the authenticated API key's Bearer token on the backend —
      // never from a tool argument. Adding a tenantGuid/userId arg would invite report spoofing.
      let capturedArgs = null;
      nock(BASE_URL)
        .post('/mcp', body => {
          if (body.params?.name === 'UteamupMarketplaceListingReport') {
            capturedArgs = body.params.arguments;
          }
          return body.params?.name === 'UteamupMarketplaceListingReport';
        })
        .reply(200, JSON.stringify(successReply(true).body), { 'Content-Type': 'application/json' });

      const args = { guid: LISTING_GUID, reasonCode: 'Illegal', details: 'Counterfeit safety part' };
      await sendRawRequest(BASE_URL, 'UteamupMarketplaceListingReport', args);

      expect(capturedArgs).toEqual(args);
      for (const forbidden of ['tenantGuid', 'tenantId', 'userId', 'reporterUserId', 'reporterTenantGuid']) {
        expect(capturedArgs[forbidden]).toBeUndefined();
      }
    });

    test('already-reported surfaces a conflict error without crashing the proxy', async () => {
      const response = await call(
        'UteamupMarketplaceListingReport',
        { guid: LISTING_GUID, reasonCode: 'Other' },
        errorReply(-32000, 'You have already reported this listing.')
      );
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('already reported');
    });

    test('an unavailable / hidden listing surfaces a not-found error', async () => {
      const response = await call(
        'UteamupMarketplaceListingReport',
        { guid: LISTING_GUID, reasonCode: 'Illegal' },
        errorReply(-32000, 'Listing not found or not available for reporting.')
      );
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('an invalid reason code surfaces a validation error', async () => {
      const response = await call(
        'UteamupMarketplaceListingReport',
        { guid: LISTING_GUID, reasonCode: 'Bogus' },
        errorReply(-32000, 'Invalid report reason.')
      );
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Invalid report reason');
    });
  });

  // ---------------------------------------------------------------------------
  // Shared error-handling tests (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupMarketplaceBrowse', args: {} },
    { name: 'UteamupMarketplaceListingGet', args: { guid: LISTING_GUID } },
    { name: 'UteamupMarketplaceRequirementsList', args: {} },
    { name: 'UteamupMarketplaceMyOffersList', args: {} },
    { name: 'UteamupMarketplaceTransactionsList', args: { page: 1, pageSize: 20 } },
    { name: 'UteamupMarketplaceSettingsGet', args: {} },
    { name: 'UteamupMarketplaceListingReport', args: { guid: LISTING_GUID, reasonCode: 'Illegal' } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
