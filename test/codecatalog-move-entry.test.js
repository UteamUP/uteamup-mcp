/**
 * Code-catalog move/reparent MCP tool test.
 *
 * Covers the MCP tool added on top of
 * POST /codecatalog/entries/by-guid/{guid}/move:
 *   - UteamupCodingsystemMoveEntryByGuid
 *
 * Generic-proxy pattern (nock-mocked backend; no real network calls). The tool
 * forwards (entryGuid, newParentGuid) to the backend, which reparents the code
 * and recomputes its + descendants' DisplayCode. Backend tier/cycle + duplicate
 * validation surfaces here as JSON-RPC errors.
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

describe('UteamupCodingsystemMoveEntryByGuid MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_codecatalog_move';

  const ENTRY_GUID = 'cccccccc-dddd-eeee-ffff-000000000001';
  const PARENT_GUID = 'cccccccc-dddd-eeee-ffff-0000000000a2';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, 'UteamupCodingsystemMoveEntryByGuid', toolArgs, mockReply);

  const movedEntry = {
    externalGuid: ENTRY_GUID,
    code: 'KRO',
    displayCode: 'FOL KRO',
    levelOrder: 0,
    parentEntryGuid: PARENT_GUID,
    isActive: true,
    isCustom: true,
    isStandard: false,
  };

  it('returns the reparented entry with the recomputed DisplayCode', async () => {
    const response = await call(
      { entryGuid: ENTRY_GUID, newParentGuid: PARENT_GUID },
      successReply(movedEntry),
    );
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.externalGuid).toBe(ENTRY_GUID);
    expect(data.parentEntryGuid).toBe(PARENT_GUID);
    expect(data.displayCode).toBe('FOL KRO');
  });

  it('surfaces a duplicate-DisplayCode conflict as a JSON-RPC error', async () => {
    const response = await call(
      { entryGuid: ENTRY_GUID, newParentGuid: PARENT_GUID },
      errorReply(-32000, "A code with display code 'FOL KRO' already exists in this coding system for the active tenant."),
    );
    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/already exists/i);
  });

  it('surfaces a tier/cycle violation as a JSON-RPC error', async () => {
    const response = await call(
      { entryGuid: ENTRY_GUID, newParentGuid: PARENT_GUID },
      errorReply(-32000, 'A code cannot be moved under one of its own descendants.'),
    );
    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/descendant/i);
  });

  it('surfaces backend permission-denied errors as JSON-RPC errors', async () => {
    const response = await call(
      { entryGuid: ENTRY_GUID, newParentGuid: PARENT_GUID },
      errorReply(-32000, 'Permission denied: Coding.Update required'),
    );
    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/Permission denied/i);
  });

  // Shared MCP error-path coverage — 401 mapping + 503 retry/back-off.
  const errorTools = [
    {
      name: 'UteamupCodingsystemMoveEntryByGuid',
      args: { entryGuid: ENTRY_GUID, newParentGuid: PARENT_GUID },
    },
  ];
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
