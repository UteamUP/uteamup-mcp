/**
 * Stock enterprise MCP tools test (stock-enterprise-phase1).
 *
 * Backend tools (Command + Handler per tool, generic-proxy pattern — nock-mocked
 * backend, no real network):
 *   UteamupStockGetItemsByLocation  — GUID-migrated (stockGuid, int stockId removed)
 *   UteamupStockListAlerts          — active alerts for a stock location
 *   UteamupStockAcknowledgeAlert    — acknowledge an alert
 *   UteamupStockSearchItems         — cross-location paged item search
 *   UteamupStockListPurchaseOrders  — paged PO list with status filter
 *   UteamupStockGetPurchaseOrder    — PO by GUID
 *   UteamupStockSubmitPurchaseOrder / UteamupStockApprovePurchaseOrder /
 *   UteamupStockCancelPurchaseOrder — PO status transitions
 *   UteamupStockGetReorderPolicy / UteamupStockUpdateReorderPolicy — reorder policy
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

describe('Stock enterprise MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_stock_enterprise';

  const STOCK_GUID = 'a1111111-1111-1111-1111-111111111111';
  const ALERT_GUID = 'b2222222-2222-2222-2222-222222222222';
  const PO_GUID = 'c3333333-3333-3333-3333-333333333333';

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

  it('forwards reviewed receipt quantities, prices and unit codes without conversion', async () => {
    const lines = [{ description: 'Bulk powder', quantity: 0.125001, unitPrice: 15.25,
      unitOfMeasure: 'kg', stockItemGuid: STOCK_GUID }];
    const captured = await captureCall('UteamupStockCreatePoFromReceipt', { lines });
    expect(captured.params.arguments.lines).toEqual(lines);
  });

  // ---------------------------------------------------------------------------
  // UteamupStockGetItemsByLocation — GUID-migrated
  // ---------------------------------------------------------------------------
  describe('UteamupStockGetItemsByLocation (GUID-migrated)', () => {
    it('returns stock items for a location GUID', async () => {
      const response = await call(
        'UteamupStockGetItemsByLocation',
        { stockGuid: STOCK_GUID },
        successReply([{ guid: 'd4444444-4444-4444-4444-444444444444', name: 'Bearing 6204', currentStock: 8 }]),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(1);
      expect(data[0].currentStock).toBe(8);
    });

    it('forwards stockGuid verbatim — the int stockId parameter is removed', async () => {
      const captured = await captureCall('UteamupStockGetItemsByLocation', { stockGuid: STOCK_GUID });
      expect(captured).not.toBeNull();
      expect(captured.params.arguments.stockGuid).toBe(STOCK_GUID);
      expect(captured.params.arguments.stockId).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Alerts
  // ---------------------------------------------------------------------------
  describe('UteamupStockListAlerts', () => {
    it('returns active alerts for a stock location', async () => {
      const response = await call(
        'UteamupStockListAlerts',
        { stockGuid: STOCK_GUID },
        successReply([{ guid: ALERT_GUID, alertType: 'LowStock', stockGuid: STOCK_GUID }]),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(1);
      expect(data[0].alertType).toBe('LowStock');
    });

    it('returns an empty array when the location has no active alerts', async () => {
      const response = await call('UteamupStockListAlerts', { stockGuid: STOCK_GUID }, successReply([]));
      expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
    });
  });

  describe('UteamupStockAcknowledgeAlert', () => {
    it('acknowledges an alert by GUID', async () => {
      const response = await call(
        'UteamupStockAcknowledgeAlert',
        { alertGuid: ALERT_GUID },
        successReply({ guid: ALERT_GUID, isAcknowledged: true }),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.isAcknowledged).toBe(true);
    });

    it('surfaces a not-found alert as a JSON-RPC error', async () => {
      const response = await call(
        'UteamupStockAcknowledgeAlert',
        { alertGuid: ALERT_GUID },
        errorReply(-32000, `Stock alert ${ALERT_GUID} not found in tenant.`),
      );
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/not found/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Cross-location item search
  // ---------------------------------------------------------------------------
  describe('UteamupStockSearchItems', () => {
    it('returns a paged result shape', async () => {
      const response = await call(
        'UteamupStockSearchItems',
        { q: 'bearing' },
        successReply({ items: [{ name: 'Bearing 6204' }], totalItems: 1, page: 1, pageSize: 50 }),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.items).toHaveLength(1);
      expect(data.totalItems).toBe(1);
    });

    it('forwards all filters and paging verbatim', async () => {
      const args = { q: 'bearing', itemType: 'Part', stockGuid: STOCK_GUID, page: 2, pageSize: 25 };
      const captured = await captureCall('UteamupStockSearchItems', args);
      expect(captured.params.arguments).toEqual(args);
    });

    it('forwards the condition grade filter verbatim', async () => {
      const args = { q: 'bearing', condition: 'Used', page: 1, pageSize: 50 };
      const captured = await captureCall('UteamupStockSearchItems', args);
      expect(captured.params.arguments).toEqual(args);
      expect(captured.params.arguments.condition).toBe('Used');
    });
  });

  // ---------------------------------------------------------------------------
  // Purchase orders
  // ---------------------------------------------------------------------------
  describe('UteamupStockListPurchaseOrders', () => {
    it('returns a paged PO list', async () => {
      const response = await call(
        'UteamupStockListPurchaseOrders',
        { status: 'Submitted', page: 1, pageSize: 50 },
        successReply({ items: [{ guid: PO_GUID, status: 'Submitted' }], totalItems: 1, page: 1, pageSize: 50 }),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.items[0].status).toBe('Submitted');
    });

    it('forwards the status filter verbatim', async () => {
      const captured = await captureCall('UteamupStockListPurchaseOrders', { status: 'Draft', page: 3, pageSize: 10 });
      expect(captured.params.arguments.status).toBe('Draft');
      expect(captured.params.arguments.page).toBe(3);
      expect(captured.params.arguments.pageSize).toBe(10);
    });
  });

  describe('UteamupStockGetPurchaseOrder', () => {
    it('returns a PO by GUID', async () => {
      const response = await call(
        'UteamupStockGetPurchaseOrder',
        { guid: PO_GUID },
        successReply({ guid: PO_GUID, status: 'Draft', items: [] }),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.guid).toBe(PO_GUID);
    });

    it('surfaces backend permission-denied as a JSON-RPC error', async () => {
      const response = await call(
        'UteamupStockGetPurchaseOrder',
        { guid: PO_GUID },
        errorReply(-32000, 'Permission denied: StockPurchaseOrder.View required'),
      );
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/Permission denied/i);
    });
  });

  describe('PO status transitions', () => {
    it('UteamupStockSubmitPurchaseOrder returns the submitted PO', async () => {
      const response = await call(
        'UteamupStockSubmitPurchaseOrder',
        { guid: PO_GUID },
        successReply({ guid: PO_GUID, status: 'Submitted' }),
      );
      expect(JSON.parse(response.body.result.content[0].text).status).toBe('Submitted');
    });

    it('UteamupStockApprovePurchaseOrder surfaces an invalid-transition JSON-RPC error', async () => {
      const response = await call(
        'UteamupStockApprovePurchaseOrder',
        { guid: PO_GUID },
        errorReply(-32000, 'Invalid transition: Draft → Approved. Allowed: Submitted → Approved'),
      );
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/Invalid transition/i);
    });

    it('UteamupStockCancelPurchaseOrder forwards the optional reason verbatim', async () => {
      const captured = await captureCall('UteamupStockCancelPurchaseOrder', { guid: PO_GUID, reason: 'duplicate order' });
      expect(captured.params.arguments.guid).toBe(PO_GUID);
      expect(captured.params.arguments.reason).toBe('duplicate order');
    });
  });

  // ---------------------------------------------------------------------------
  // Reorder policy
  // ---------------------------------------------------------------------------
  describe('Reorder policy tools', () => {
    it('UteamupStockGetReorderPolicy returns the policy (defaults when never configured)', async () => {
      const response = await call(
        'UteamupStockGetReorderPolicy',
        {},
        successReply({ isEnabled: false, cronSchedule: '0 3 * * *', autoSubmitEnabled: false, autoDeductOnWorkorderCompletionEnabled: false }),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.cronSchedule).toBe('0 3 * * *');
      expect(data.isEnabled).toBe(false);
    });

    it('UteamupStockUpdateReorderPolicy forwards the four simple args verbatim', async () => {
      const args = { isEnabled: true, cronSchedule: '0 4 * * *', autoSubmitEnabled: true, autoDeductOnWorkorderCompletionEnabled: false };
      const captured = await captureCall('UteamupStockUpdateReorderPolicy', args);
      expect(captured.params.arguments).toEqual(args);
    });

    it('takes NO userId / tenantId args — identity comes from the Bearer token', async () => {
      const captured = await captureCall('UteamupStockUpdateReorderPolicy', { isEnabled: true, cronSchedule: '0 3 * * *' });
      expect(captured.params.arguments.userId).toBeUndefined();
      expect(captured.params.arguments.tenantId).toBeUndefined();
      expect(captured.params.arguments.tenantGuid).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Shared compliance / error handling
  // ---------------------------------------------------------------------------
  it('starts a pending count by public GUID and preserves quantity precision', async () => {
    const tool = 'UteamupStockStartStockTake';
    const args = { stockTakeGuid: STOCK_GUID };
    expect((await captureCall(tool, args)).params.arguments).toEqual(args);
    const response = await call(tool, args, successReply({
      guid: STOCK_GUID, status: 'InProgress',
      items: [{ expectedQuantity: 0.125001, actualQuantity: null, unitOfMeasure: 'kg', quantityDecimalPlaces: 6 }],
    }));
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.status).toBe('InProgress');
    expect(data.items[0].expectedQuantity).toBe(0.125001);
  });

  const allTools = [
    { name: 'UteamupStockStartStockTake', args: { stockTakeGuid: STOCK_GUID } },
    { name: 'UteamupStockGetItemsByLocation', args: { stockGuid: STOCK_GUID } },
    { name: 'UteamupStockListAlerts', args: { stockGuid: STOCK_GUID } },
    { name: 'UteamupStockAcknowledgeAlert', args: { alertGuid: ALERT_GUID } },
    { name: 'UteamupStockSearchItems', args: { q: 'bearing' } },
    { name: 'UteamupStockListPurchaseOrders', args: { page: 1, pageSize: 50 } },
    { name: 'UteamupStockGetPurchaseOrder', args: { guid: PO_GUID } },
    { name: 'UteamupStockSubmitPurchaseOrder', args: { guid: PO_GUID } },
    { name: 'UteamupStockApprovePurchaseOrder', args: { guid: PO_GUID } },
    { name: 'UteamupStockCancelPurchaseOrder', args: { guid: PO_GUID } },
    { name: 'UteamupStockGetReorderPolicy', args: {} },
    { name: 'UteamupStockUpdateReorderPolicy', args: { isEnabled: true, cronSchedule: '0 3 * * *' } },
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
