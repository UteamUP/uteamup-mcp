/**
 * Stock suggested-orders MCP tools test (stock-reseller-catalog vendor-catalog section 6).
 *
 * Two tools over the suggested-orders inbox: UteamupStockGetSuggestedOrders (reorder
 * shortfalls grouped by preferred vendor) and UteamupStockCreateSuggestedOrderPo (turn
 * one confirmed vendor group into a Draft PO). Omitting the vendor GUID confirms the
 * no-resolvable-vendor group.
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

describe('Stock suggested-orders MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_suggested_orders';

  const VENDOR_GUID = 'a1111111-1111-1111-1111-111111111111';
  const ITEM_GUID = 'b2222222-2222-2222-2222-222222222222';
  const PO_GUID = 'c3333333-3333-3333-3333-333333333333';

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

  describe('UteamupStockGetSuggestedOrders', () => {
    it('returns vendor groups with MOQ-rounded line quantities', async () => {
      const response = await call(
        'UteamupStockGetSuggestedOrders',
        {},
        successReply({
          groups: [
            {
              vendorGuid: VENDOR_GUID,
              vendorName: 'Acme',
              estimatedTotal: 55,
              lines: [
                { stockItemGuid: ITEM_GUID, stockItemName: 'Bearing 6204', suggestedQuantity: 7, orderQuantity: 10, unitCost: 5.5, vendorPartNumber: 'AC-1', leadTimeDays: 14 },
              ],
            },
          ],
        }),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.groups[0].vendorName).toBe('Acme');
      expect(data.groups[0].lines[0].suggestedQuantity).toBe(7);
      expect(data.groups[0].lines[0].orderQuantity).toBe(10);
    });

    it('takes no arguments (tenant comes from the Bearer token)', async () => {
      const captured = await captureCall('UteamupStockGetSuggestedOrders', {});
      expect(captured.params.arguments).toEqual({});
    });
  });

  describe('UteamupStockCreateSuggestedOrderPo', () => {
    it('forwards the vendor GUID verbatim', async () => {
      const captured = await captureCall('UteamupStockCreateSuggestedOrderPo', { vendorGuid: VENDOR_GUID });
      expect(captured.params.arguments).toEqual({ vendorGuid: VENDOR_GUID });
    });

    it('confirms the no-resolvable-vendor group when the GUID is omitted', async () => {
      const captured = await captureCall('UteamupStockCreateSuggestedOrderPo', {});
      expect(captured.params.arguments.vendorGuid).toBeUndefined();
    });

    it('returns the created Draft purchase order', async () => {
      const response = await call(
        'UteamupStockCreateSuggestedOrderPo',
        { vendorGuid: VENDOR_GUID },
        successReply({ guid: PO_GUID, status: 'Draft', vendorGuid: VENDOR_GUID }),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.guid).toBe(PO_GUID);
      expect(data.status).toBe('Draft');
    });

    it('surfaces a no-live-shortfall error without crashing the proxy', async () => {
      const response = await call(
        'UteamupStockCreateSuggestedOrderPo',
        { vendorGuid: VENDOR_GUID },
        {
          status: 200,
          body: { jsonrpc: '2.0', error: { code: -32000, message: 'No live shortfall for the requested vendor group' }, id: 1 },
        },
      );
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('No live shortfall');
    });
  });

  describe('identity comes from the Bearer token (spoofing guard)', () => {
    it.each([
      ['UteamupStockGetSuggestedOrders', {}],
      ['UteamupStockCreateSuggestedOrderPo', { vendorGuid: VENDOR_GUID }],
    ])('%s takes no userId / tenantId argument', async (name, args) => {
      const captured = await captureCall(name, args);
      expect(captured.params.arguments.userId).toBeUndefined();
      expect(captured.params.arguments.tenantId).toBeUndefined();
      expect(captured.params.arguments.tenantGuid).toBeUndefined();
    });
  });

  const allTools = [
    { name: 'UteamupStockGetSuggestedOrders', args: {} },
    { name: 'UteamupStockCreateSuggestedOrderPo', args: { vendorGuid: VENDOR_GUID } },
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
