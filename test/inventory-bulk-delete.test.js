/**
 * BulkDeleteInventoryItems MCP tool test.
 *
 * Backend tool: BulkDeleteInventoryCommand + Handler (IND-001,
 * industry-failures.md). A QA run selected 355 rows across every inventory type
 * while the Asset filter was visibly active and destroyed 23
 * Parts/Tools/Chemicals. The MCP surface already exposes an unscoped per-item
 * DeleteInventoryItem, so this scope-checked batch is the SAFER primitive — the
 * server resolves each row's real type and refuses the WHOLE request on any
 * item outside the declared scope. Assets are never bulk-deleted (they are
 * archived), so an asset GUID always comes back out of scope.
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

describe('BulkDeleteInventoryItems MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_inventory_bulk_delete';

  const ASSET = 'aaaaaaaa-0000-4000-8000-000000000001';
  const PART_A = 'bbbbbbbb-0000-4000-8000-000000000001';
  const PART_B = 'bbbbbbbb-0000-4000-8000-000000000002';
  const TOOL = 'cccccccc-0000-4000-8000-000000000001';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, 'BulkDeleteInventoryItems', toolArgs, mockReply);

  it('reports per-type impact without deleting when dryRun is set', async () => {
    const response = await call(
      { scope: ['part'], guids: [PART_A, PART_B], dryRun: true },
      successReply({
        dryRun: true,
        requested: 2,
        deleted: 2,
        countsByType: { part: 2 },
        failed: [],
        outOfScope: [],
      }),
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.dryRun).toBe(true);
    expect(data.deleted).toBe(2);
    expect(data.countsByType.part).toBe(2);
    expect(data.outOfScope).toEqual([]);
  });

  it('refuses the whole batch when an item falls outside the declared scope', async () => {
    // The caller asked for parts only; one GUID resolves to a tool. Nothing is
    // deleted — this is the guard the QA run needed and did not have.
    const response = await call(
      { scope: ['part'], guids: [PART_A, TOOL] },
      successReply({
        dryRun: false,
        requested: 2,
        deleted: 0,
        countsByType: {},
        failed: [],
        outOfScope: [
          { guid: TOOL, type: 'tool', reason: "Type 'tool' is outside the requested scope." },
        ],
      }),
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.deleted).toBe(0);
    expect(data.outOfScope).toHaveLength(1);
    expect(data.outOfScope[0].type).toBe('tool');
  });

  it('never deletes an asset: it comes back out of scope with the archive hint', async () => {
    const response = await call(
      { scope: ['part'], guids: [PART_A, ASSET] },
      successReply({
        dryRun: false,
        requested: 2,
        deleted: 0,
        countsByType: {},
        failed: [],
        outOfScope: [
          { guid: ASSET, type: 'asset', reason: 'Assets are archived, never deleted. Archive it instead.' },
        ],
      }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.deleted).toBe(0);
    expect(data.outOfScope[0].type).toBe('asset');
    expect(data.outOfScope[0].reason).toMatch(/archive/i);
  });

  it('reports a row it could not delete while still deleting the rest', async () => {
    const response = await call(
      { scope: ['part'], guids: [PART_A, PART_B] },
      successReply({
        dryRun: false,
        requested: 2,
        deleted: 1,
        countsByType: { part: 1 },
        failed: [{
          guid: PART_B,
          type: 'part',
          reason: 'This part has work order or meter history and cannot be deleted. Archive it instead.',
        }],
        outOfScope: [],
      }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.deleted).toBe(1);
    expect(data.failed[0].reason).toMatch(/archive it instead/i);
  });

  it('surfaces a missing per-type delete right as a JSON-RPC error', async () => {
    // Holding Part.Delete must never authorise a batch scoped to tools too.
    const response = await call(
      { scope: ['part', 'tool'], guids: [PART_A, TOOL] },
      errorReply(-32000, 'Permission denied: Tool.Delete is required.'),
    );

    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/Permission denied: Tool\.Delete/i);
  });

  const errorTools = [
    {
      name: 'BulkDeleteInventoryItems',
      args: { scope: ['part'], guids: [PART_A], dryRun: true },
    },
  ];
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
