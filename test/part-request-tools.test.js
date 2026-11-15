/**
 * Part request MCP tools test (KAN-2, feature 6947d22a-3513-4970-8978-2fd3a9973200).
 *
 * Four tools over spare part requisitions: UteamupPartRequestCreate (draft/unsent purchase
 * request, Pending status, linkable to a specific asset and catalog part without approval
 * or order), UteamupPartRequestList, UteamupPartRequestGet, UteamupPartRequestUpdate.
 *
 * Generic-proxy pattern: nock-mocked backend /mcp POST, GUIDs only, no real network.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  sendRawRequest,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Part request MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_part_request';

  const PART_GUID = 'a1111111-1111-1111-1111-111111111111';
  const ASSET_GUID = 'b2222222-2222-2222-2222-222222222222';
  const REQUEST_GUID = 'c3333333-3333-3333-3333-333333333333';

  const requisition = {
    guid: REQUEST_GUID,
    tenantGuid: 'd4444444-4444-4444-4444-444444444444',
    partGuid: PART_GUID,
    partName: 'Netac NV7000-t 1TB NVMe SSD',
    partNumber: 'NV7000T-1TB',
    quantity: 1,
    uom: 'pcs',
    estimatedUnitCost: 89.9,
    currency: 'EUR',
    assetGuid: ASSET_GUID,
    assetName: 'GMKtec NucBox M5 Ultra (Proxmox)',
    urgency: 'low',
    status: 'pending',
    stockPurchaseOrderGuid: null,
    requestedAt: '2026-11-13T15:20:52Z',
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  /** Capture the forwarded JSON-RPC body for argument round-trip assertions. */
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

  describe('UteamupPartRequestCreate', () => {
    it('returns the created draft requisition', async () => {
      const response = await call(
        'UteamupPartRequestCreate',
        {
          partName: 'Netac NV7000-t 1TB NVMe SSD',
          quantity: 1,
          partGuid: PART_GUID,
          assetGuid: ASSET_GUID,
          urgency: 'low',
          notes: 'Planned purchase for slot 2; no order yet.',
        },
        successReply(requisition),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.status).toBe('pending');
      expect(data.assetGuid).toBe(ASSET_GUID);
      expect(data.stockPurchaseOrderGuid).toBeNull();
    });

    it('round-trips the create arguments verbatim', async () => {
      const args = {
        partName: 'Netac NV7000-t 1TB NVMe SSD',
        quantity: 2,
        partGuid: PART_GUID,
        partNumber: 'NV7000T-1TB',
        assetGuid: ASSET_GUID,
        urgency: 'high',
        estimatedUnitCost: 89.9,
        currency: 'EUR',
        uom: 'pcs',
      };
      const captured = await captureCall('UteamupPartRequestCreate', args);
      expect(captured.params.arguments).toEqual(args);
    });

    it('forwards the JSON-RPC error shape without crashing the proxy', async () => {
      const response = await call(
        'UteamupPartRequestCreate',
        { partName: 'SSD', assetGuid: ASSET_GUID },
        errorReply(-32602, 'invalid_argument: Asset with GUID ... not found.'),
      );

      expect(response.status).toBe(200);
      expect(response.body.error.code).toBe(-32602);
      expect(response.body.error.message).toContain('invalid_argument');
    });
  });

  describe('UteamupPartRequestList', () => {
    it('returns the paged requisition list', async () => {
      const response = await call(
        'UteamupPartRequestList',
        { status: 'pending', assetGuid: ASSET_GUID, page: 1, pageSize: 50 },
        successReply({ items: [requisition], totalItems: 1, page: 1, pageSize: 50 }),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.totalItems).toBe(1);
      expect(data.items[0].guid).toBe(REQUEST_GUID);
    });

    it('surfaces an empty list as an empty items array', async () => {
      const response = await call(
        'UteamupPartRequestList',
        { status: 'pending', assetGuid: ASSET_GUID },
        successReply({ items: [], totalItems: 0, page: 1, pageSize: 50 }),
      );

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.items).toEqual([]);
    });

    it('round-trips the list filters verbatim', async () => {
      const args = { status: 'pending', urgency: 'critical', assetGuid: ASSET_GUID, workorderGuid: REQUEST_GUID, page: 2, pageSize: 25 };
      const captured = await captureCall('UteamupPartRequestList', args);
      expect(captured.params.arguments).toEqual(args);
    });
  });

  describe('UteamupPartRequestGet', () => {
    it('returns one requisition by GUID', async () => {
      const response = await call(
        'UteamupPartRequestGet',
        { requestGuid: REQUEST_GUID },
        successReply(requisition),
      );

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.guid).toBe(REQUEST_GUID);
      expect(data.partName).toBe('Netac NV7000-t 1TB NVMe SSD');
    });

    it('round-trips the GUID lookup', async () => {
      const captured = await captureCall('UteamupPartRequestGet', { requestGuid: REQUEST_GUID });
      expect(captured.params.arguments).toEqual({ requestGuid: REQUEST_GUID });
    });
  });

  describe('UteamupPartRequestUpdate', () => {
    it('returns the updated pending requisition', async () => {
      const response = await call(
        'UteamupPartRequestUpdate',
        { requestGuid: REQUEST_GUID, partName: 'Netac NV7000-t 1TB NVMe SSD', quantity: 2, assetGuid: ASSET_GUID, urgency: 'high' },
        successReply({ ...requisition, quantity: 2, urgency: 'high' }),
      );

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.quantity).toBe(2);
      expect(data.urgency).toBe('high');
      expect(data.status).toBe('pending');
    });

    it('round-trips the update arguments verbatim', async () => {
      const args = { requestGuid: REQUEST_GUID, partName: 'SSD', quantity: 1, urgency: 'medium' };
      const captured = await captureCall('UteamupPartRequestUpdate', args);
      expect(captured.params.arguments).toEqual(args);
    });

    it('forwards the pending-only invalid_state error', async () => {
      const response = await call(
        'UteamupPartRequestUpdate',
        { requestGuid: REQUEST_GUID, partName: 'SSD' },
        errorReply(-32602, 'invalid_state: Only Pending part requests can be modified.'),
      );

      expect(response.body.error.message).toContain('invalid_state');
    });
  });

  describeJsonRpcCompliance(call, [
    { name: 'UteamupPartRequestCreate', args: { partName: 'SSD', assetGuid: ASSET_GUID } },
    { name: 'UteamupPartRequestList', args: { status: 'pending' } },
    { name: 'UteamupPartRequestGet', args: { requestGuid: REQUEST_GUID } },
    { name: 'UteamupPartRequestUpdate', args: { requestGuid: REQUEST_GUID, partName: 'SSD' } },
  ]);

  describe401Unauthorized(BASE_URL, [
    { name: 'UteamupPartRequestCreate', args: { partName: 'SSD' } },
    { name: 'UteamupPartRequestList', args: {} },
    { name: 'UteamupPartRequestGet', args: { requestGuid: REQUEST_GUID } },
    { name: 'UteamupPartRequestUpdate', args: { requestGuid: REQUEST_GUID, partName: 'SSD' } },
  ]);

  describe503ServiceUnavailable(BASE_URL, [
    { name: 'UteamupPartRequestCreate', args: { partName: 'SSD' } },
    { name: 'UteamupPartRequestList', args: {} },
    { name: 'UteamupPartRequestGet', args: { requestGuid: REQUEST_GUID } },
    { name: 'UteamupPartRequestUpdate', args: { requestGuid: REQUEST_GUID, partName: 'SSD' } },
  ]);

  describe('regression guards', () => {
    test.each([
      ['UteamupPartRequestCreate', { partName: 'SSD', assetGuid: ASSET_GUID }],
      ['UteamupPartRequestList', { status: 'pending', assetGuid: ASSET_GUID }],
      ['UteamupPartRequestGet', { requestGuid: REQUEST_GUID }],
      ['UteamupPartRequestUpdate', { requestGuid: REQUEST_GUID, partName: 'SSD' }],
    ])('%s takes no userId / tenantId argument', async (name, args) => {
      const captured = await captureCall(name, args);
      expect(captured.params.arguments.userId).toBeUndefined();
      expect(captured.params.arguments.tenantId).toBeUndefined();
      expect(captured.params.arguments.tenantGuid).toBeUndefined();
    });
  });
});
