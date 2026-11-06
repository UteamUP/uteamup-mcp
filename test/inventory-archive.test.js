/**
 * ArchiveInventoryItem and RestoreInventoryItem MCP tool tests.
 *
 * Backend tools: ArchiveInventoryItemCommand / RestoreInventoryItemCommand + InventoryArchiveCommandHandler.
 * A part, tool or chemical with history is archived instead of deleted: it leaves lists, searches and
 * pickers and stays in every work order row that names it. Restore brings parts, tools, chemicals and
 * assets back. The permission follows the item type (Part.Delete, Tool.Delete, Chemical.Delete, Asset.Delete).
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

describe('Inventory archive MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_inventory_archive';

  const PART = 'bbbbbbbb-0000-4000-8000-000000000001';
  const ASSET = 'aaaaaaaa-0000-4000-8000-000000000001';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (tool, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, tool, toolArgs, mockReply);

  it('archives a part and returns when it was archived', async () => {
    const response = await call(
      'ArchiveInventoryItem',
      { itemType: 'part', itemGuid: PART },
      successReply({ type: 'part', guid: PART, archivedAtUtc: '2026-11-06T12:00:00Z' }),
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.type).toBe('part');
    expect(data.guid).toBe(PART);
    expect(data.archivedAtUtc).toBeTruthy();
  });

  it('surfaces a stocked item as item_stocked so the caller retires the stock first', async () => {
    const response = await call(
      'ArchiveInventoryItem',
      { itemType: 'part', itemGuid: PART },
      errorReply(-32000, 'item_stocked: This item is still stocked in 2 stock location(s). Retire it from stock before archiving it.'),
    );

    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/item_stocked/);
  });

  it('surfaces a missing delete right for the item type as a JSON-RPC error', async () => {
    const response = await call(
      'ArchiveInventoryItem',
      { itemType: 'part', itemGuid: PART },
      errorReply(-32000, 'Permission denied: Part.Delete required'),
    );

    expect(response.body.error.message).toMatch(/Part\.Delete/);
  });

  it('restores an archived asset', async () => {
    const response = await call(
      'RestoreInventoryItem',
      { itemType: 'asset', itemGuid: ASSET },
      successReply({ type: 'asset', guid: ASSET, archivedAtUtc: null }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.type).toBe('asset');
    expect(data.archivedAtUtc).toBeNull();
  });

  it('surfaces an archived parent as parent_archived', async () => {
    const response = await call(
      'RestoreInventoryItem',
      { itemType: 'asset', itemGuid: ASSET },
      errorReply(-32000, 'parent_archived: The parent asset is archived. Restore it first.'),
    );

    expect(response.body.error.message).toMatch(/parent_archived/);
  });

  it('surfaces an item outside the tenant as not_found', async () => {
    const response = await call(
      'RestoreInventoryItem',
      { itemType: 'part', itemGuid: PART },
      errorReply(-32000, 'not_found: Inventory item unavailable.'),
    );

    expect(response.body.error.message).toMatch(/not_found/);
  });

  const errorTools = [
    { name: 'ArchiveInventoryItem', args: { itemType: 'tool', itemGuid: PART } },
    { name: 'RestoreInventoryItem', args: { itemType: 'chemical', itemGuid: PART } },
  ];
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
