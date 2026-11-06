/**
 * uteamup_stock_location_archive and uteamup_stock_location_restore MCP tool tests.
 *
 * Backend tools: ArchiveStockLocationCommand / RestoreStockLocationCommand + StockLocationArchiveCommandHandler.
 * A stock location with history is archived instead of deleted: it leaves lists, searches and pickers and keeps
 * its counts and movements. Both tools need Stock.Update, the same permission as the REST routes.
 *
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
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Stock location archive MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_stock_location_archive';

  const STOCK = 'cccccccc-0000-4000-8000-000000000001';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (tool, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, tool, toolArgs, mockReply);

  it('archives a stock location and returns when it was archived', async () => {
    const response = await call(
      'uteamup_stock_location_archive',
      { stockGuid: STOCK },
      successReply({ guid: STOCK, name: 'Old store', archivedAt: '2026-11-06T12:00:00Z' }),
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.guid).toBe(STOCK);
    expect(data.archivedAt).toBeTruthy();
  });

  it('surfaces a stocked location as location_stocked so the caller moves the items first', async () => {
    const response = await call(
      'uteamup_stock_location_archive',
      { stockGuid: STOCK },
      errorReply(-32000, 'location_stocked: Cannot archive stock location. It still holds 3 active item(s). Relocate or archive them first.'),
    );

    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/location_stocked/);
  });

  it('surfaces a missing Stock.Update right as a JSON-RPC error', async () => {
    const response = await call(
      'uteamup_stock_location_archive',
      { stockGuid: STOCK },
      errorReply(-32000, 'Permission denied: Stock.Update required'),
    );

    expect(response.body.error.message).toMatch(/Stock\.Update/);
  });

  it('restores an archived stock location', async () => {
    const response = await call(
      'uteamup_stock_location_restore',
      { stockGuid: STOCK },
      successReply({ guid: STOCK, name: 'Old store', archivedAt: null }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.guid).toBe(STOCK);
    expect(data.archivedAt).toBeNull();
  });

  it('surfaces a location without an active physical location as location_unlinked', async () => {
    const response = await call(
      'uteamup_stock_location_restore',
      { stockGuid: STOCK },
      errorReply(-32000, 'location_unlinked: Link the stock location to an active physical location before restoring it.'),
    );

    expect(response.body.error.message).toMatch(/location_unlinked/);
  });

  it('surfaces a location outside the tenant as not_found', async () => {
    const response = await call(
      'uteamup_stock_location_restore',
      { stockGuid: STOCK },
      errorReply(-32000, 'not_found: Stock location unavailable.'),
    );

    expect(response.body.error.message).toMatch(/not_found/);
  });

  const errorTools = [
    { name: 'uteamup_stock_location_archive', args: { stockGuid: STOCK } },
    { name: 'uteamup_stock_location_restore', args: { stockGuid: STOCK } },
  ];
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
