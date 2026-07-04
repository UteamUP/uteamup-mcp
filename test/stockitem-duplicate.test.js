/**
 * UteamupStockItemDuplicate MCP tool test.
 *
 * Backend tool: DuplicateStockItemCommand + Handler — duplicates a stock item
 * (Part / Tool / Chemical) into a chosen target stock location, sharing the
 * source's catalog master and starting at zero stock.
 * Generic-proxy pattern (nock-mocked backend; no real network).
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('UteamupStockItemDuplicate MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_stockitem_duplicate';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, 'UteamupStockItemDuplicate', toolArgs, mockReply);

  const itemGuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const targetStockGuid = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  const newItemGuid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const sampleItem = {
    guid: newItemGuid,
    name: 'Bearing 6204-2RS',
    type: 'Part',
    currentStock: 0,
    stockGuid: targetStockGuid,
    stockName: 'Warehouse B',
  };

  // ---- happy path -------------------------------------------------------

  it('returns the newly duplicated stock item on success', async () => {
    const response = await call(
      { itemGuid, targetStockGuid },
      successReply(sampleItem),
    );
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.guid).toBe(newItemGuid);
    expect(data.name).toBe('Bearing 6204-2RS');
    expect(data.stockGuid).toBe(targetStockGuid);
    // Clone starts at zero on-hand quantity.
    expect(data.currentStock).toBe(0);
  });

  // ---- optional name override ------------------------------------------

  it('forwards an optional name override to the backend', async () => {
    const renamed = { ...sampleItem, name: 'Bearing 6204-2RS (Spare)' };
    const response = await call(
      { itemGuid, targetStockGuid, name: 'Bearing 6204-2RS (Spare)' },
      successReply(renamed),
    );
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.name).toBe('Bearing 6204-2RS (Spare)');
  });

  // ---- null response (source not found / wrong tenant) ------------------

  it('returns null when the source stock item is not found for the tenant', async () => {
    const response = await call(
      { itemGuid: 'dddddddd-dddd-dddd-dddd-dddddddddddd', targetStockGuid },
      successReply(null),
    );
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toBeNull();
  });

  // ---- permission denied -----------------------------------------------

  it('surfaces backend permission-denied as a JSON-RPC error', async () => {
    const response = await call(
      { itemGuid, targetStockGuid },
      errorReply(-32000, 'Permission denied: Stock.Update required'),
    );
    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/Permission denied/i);
  });

  // ---- conflict: target location already holds the master ---------------

  it('surfaces a backend conflict when the target location already holds that master', async () => {
    const response = await call(
      { itemGuid, targetStockGuid },
      errorReply(-32000, 'Target location already holds this stock item.'),
    );
    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/already holds/i);
  });

  // ---- argument round-trip (proxy forwards args verbatim) ---------------

  it('forwards the itemGuid and targetStockGuid arguments without modification', async () => {
    const response = await call(
      { itemGuid, targetStockGuid },
      successReply(sampleItem),
    );
    // nock only matches when params.name === 'UteamupStockItemDuplicate';
    // a 200 confirms the proxy forwarded the required GUID args intact.
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.guid).toBe(newItemGuid);
  });

  // ---- regression guard: no userId / tenantId arg ----------------------

  it('does NOT expose userId or tenantId as a tool argument (identity comes from Bearer token)', async () => {
    const response = await call(
      { itemGuid, targetStockGuid, userId: 'spoofed-user', tenantId: 'spoofed-tenant' },
      successReply(sampleItem),
    );
    expect(response.status).toBe(200);
  });

  // ---- standard compliance / error-handling suites ---------------------

  const complianceTools = [
    { name: 'UteamupStockItemDuplicate', args: { itemGuid, targetStockGuid } },
  ];

  describeJsonRpcCompliance(
    (name, args, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, name, args, mockReply),
    complianceTools,
  );
  describe401Unauthorized(BASE_URL, complianceTools);
  describe503ServiceUnavailable(BASE_URL, complianceTools);
});
