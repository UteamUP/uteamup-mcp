/**
 * Vendor part-catalog MCP tools test (stock-reseller-catalog section 6).
 *
 * Four tools over the per-vendor part catalog: UteamupPartListVendorCatalog,
 * UteamupPartUpsertVendorCatalog, UteamupPartDeleteVendorCatalog (part-scoped) and
 * UteamupVendorGetCatalog (the reverse, by vendor).
 *
 * Generic-proxy pattern: nock-mocked backend /mcp POST, GUIDs only.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  sendRawRequest,
  successReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Vendor part-catalog MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_vendor_catalog';

  const PART_GUID = 'a1111111-1111-1111-1111-111111111111';
  const VENDOR_GUID = 'b2222222-2222-2222-2222-222222222222';
  const ENTRY_GUID = 'c3333333-3333-3333-3333-333333333333';
  const CURRENCY_GUID = 'd4444444-4444-4444-4444-444444444444';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const captureCall = async (toolName, toolArgs) => {
    let captured = null;
    nock(BASE_URL)
      .post('/mcp', body => {
        captured = body;
        return body.method === 'tools/call' && body.params?.name === toolName;
      })
      .reply(200, JSON.stringify(successReply({}).body), { 'Content-Type': 'application/json' });
    await sendRawRequest(BASE_URL, toolName, toolArgs);
    return captured;
  };

  describe('UteamupPartListVendorCatalog', () => {
    it('returns the vendor entries with the preferred one flagged', async () => {
      const response = await call(
        'UteamupPartListVendorCatalog',
        { partGuid: PART_GUID },
        successReply([
          { guid: ENTRY_GUID, vendorGuid: VENDOR_GUID, vendorName: 'Acme', vendorPartNumber: 'AC-1', unitCost: 5.5, minimumOrderQuantity: 10, isPreferred: true },
        ]),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].isPreferred).toBe(true);
      expect(data[0].minimumOrderQuantity).toBe(10);
    });

    it('forwards the part GUID verbatim', async () => {
      const captured = await captureCall('UteamupPartListVendorCatalog', { partGuid: PART_GUID });
      expect(captured.params.arguments).toEqual({ partGuid: PART_GUID });
    });
  });

  describe('UteamupPartUpsertVendorCatalog', () => {
    it('forwards the full entry payload verbatim', async () => {
      const args = {
        partGuid: PART_GUID,
        vendorGuid: VENDOR_GUID,
        vendorPartNumber: 'AC-9',
        unitCost: 12.25,
        currencyGuid: CURRENCY_GUID,
        minimumOrderQuantity: 25,
        leadTimeDays: 14,
        isPreferred: true,
      };
      const captured = await captureCall('UteamupPartUpsertVendorCatalog', args);
      expect(captured.params.arguments).toEqual(args);
    });

    it('returns the upserted entry', async () => {
      const response = await call(
        'UteamupPartUpsertVendorCatalog',
        { partGuid: PART_GUID, vendorGuid: VENDOR_GUID, vendorPartNumber: 'AC-9', isPreferred: true },
        successReply({ guid: ENTRY_GUID, vendorGuid: VENDOR_GUID, vendorPartNumber: 'AC-9', isPreferred: true }),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.vendorPartNumber).toBe('AC-9');
      expect(data.isPreferred).toBe(true);
    });
  });

  describe('UteamupPartDeleteVendorCatalog', () => {
    it('returns true on delete and forwards both GUIDs', async () => {
      const captured = await captureCall('UteamupPartDeleteVendorCatalog', { partGuid: PART_GUID, entryGuid: ENTRY_GUID });
      expect(captured.params.arguments).toEqual({ partGuid: PART_GUID, entryGuid: ENTRY_GUID });
    });
  });

  describe('UteamupVendorGetCatalog', () => {
    it('returns the entries a vendor supplies', async () => {
      const response = await call(
        'UteamupVendorGetCatalog',
        { vendorGuid: VENDOR_GUID },
        successReply([
          { guid: ENTRY_GUID, vendorGuid: VENDOR_GUID, partGuid: PART_GUID, partName: 'Bearing 6204', vendorPartNumber: 'AC-1' },
        ]),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].partName).toBe('Bearing 6204');
    });

    it('forwards the vendor GUID verbatim', async () => {
      const captured = await captureCall('UteamupVendorGetCatalog', { vendorGuid: VENDOR_GUID });
      expect(captured.params.arguments).toEqual({ vendorGuid: VENDOR_GUID });
    });
  });

  describe('identity comes from the Bearer token (spoofing guard)', () => {
    it.each([
      ['UteamupPartListVendorCatalog', { partGuid: PART_GUID }],
      ['UteamupVendorGetCatalog', { vendorGuid: VENDOR_GUID }],
    ])('%s takes no userId / tenantId argument', async (name, args) => {
      const captured = await captureCall(name, args);
      expect(captured.params.arguments.userId).toBeUndefined();
      expect(captured.params.arguments.tenantId).toBeUndefined();
      expect(captured.params.arguments.tenantGuid).toBeUndefined();
    });
  });

  const allTools = [
    { name: 'UteamupPartListVendorCatalog', args: { partGuid: PART_GUID } },
    { name: 'UteamupPartUpsertVendorCatalog', args: { partGuid: PART_GUID, vendorGuid: VENDOR_GUID, vendorPartNumber: 'AC-9' } },
    { name: 'UteamupPartDeleteVendorCatalog', args: { partGuid: PART_GUID, entryGuid: ENTRY_GUID } },
    { name: 'UteamupVendorGetCatalog', args: { vendorGuid: VENDOR_GUID } },
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
