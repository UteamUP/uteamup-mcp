/**
 * Quick Close MCP tool tests
 *
 * Covers the UteamupWorkorderQuickClose tool which proxies to the backend
 * Quick Close flow (create + close a workorder in a single transaction).
 *
 * The Node.js MCP server is a pure OAuth/JSON-RPC proxy — the tool itself
 * lives in the backend C# surface (MCP/Tools/WorkOrderTools.cs ->
 * MCP/Commands/WorkOrder/QuickCloseWorkOrderCommand.cs). These tests verify
 * that the proxy forwards the call correctly and surfaces the backend's
 * responses (success, idempotent replay, and the shared 401/503 error paths).
 *
 * Pattern mirrors bugs-and-features.test.js and project-my-projects.test.js.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Quick Close MCP Tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_quick_close';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ── Shared mock data ─────────────────────────────────────────────────────
  const TEMPLATE_GUID = '11111111-1111-1111-1111-111111111111';
  const ASSET_GUID    = '22222222-2222-2222-2222-222222222222';
  const TENANT_GUID   = '33333333-3333-3333-3333-333333333333';
  const WORKORDER_GUID = '44444444-4444-4444-4444-444444444444';

  const quickClosedWorkorder = {
    id: 501,
    guid: WORKORDER_GUID,
    name: 'Lightbulb Replacement',
    ticketId: 'WO-501',
    status: 4,
    priority: 2,
    tenantGuid: TENANT_GUID,
    resolutionNote: 'Replaced bulb, tested fixture.',
    quickClosedAt: '2026-04-19T15:32:00Z',
    quickClosedById: 'user-1',
    quickClosedByName: 'Field Worker 1',
  };

  const validArgs = {
    templateGuid: TEMPLATE_GUID,
    assetGuid: ASSET_GUID,
    resolutionNote: 'Replaced bulb, tested fixture.',
    idempotencyKey: 'abcd-efgh-ijkl-1234',
  };

  // ── Happy path ───────────────────────────────────────────────────────────
  describe('UteamupWorkorderQuickClose', () => {
    test('returns the created-and-closed workorder on fresh submit', async () => {
      const response = await call(
        'UteamupWorkorderQuickClose',
        validArgs,
        successReply(quickClosedWorkorder),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.id).toBe(501);
      expect(data.quickClosedAt).toBe('2026-04-19T15:32:00Z');
      expect(data.resolutionNote).toBe('Replaced bulb, tested fixture.');
    });

    test('returns the SAME workorder on idempotent replay', async () => {
      // Backend returns the original workorder with a replay flag when
      // the same idempotency key is re-sent. The proxy just passes this
      // through — the MCP caller sees the same response as a fresh submit.
      const response = await call(
        'UteamupWorkorderQuickClose',
        validArgs,
        successReply(quickClosedWorkorder),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.guid).toBe(WORKORDER_GUID);
    });

    test('forwards optional industryCodeGuid and performedAt when supplied', async () => {
      const response = await call(
        'UteamupWorkorderQuickClose',
        {
          ...validArgs,
          industryCodeGuid: '55555555-5555-5555-5555-555555555555',
          performedAt: '2026-04-19T15:30:00Z',
        },
        successReply(quickClosedWorkorder),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.id).toBe(501);
    });

    test('surfaces a 403 rejection (missing permission / license) as an RPC error', async () => {
      const response = await call(
        'UteamupWorkorderQuickClose',
        validArgs,
        errorReply(403, 'Permission denied: WorkOrder.QuickClose required'),
      );
      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
    });

    test('surfaces a 429 rate-limit rejection as an RPC error', async () => {
      const response = await call(
        'UteamupWorkorderQuickClose',
        validArgs,
        errorReply(429, 'Daily Quick Close cap (50) reached for this user.'),
      );
      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
    });

    test('surfaces a 422 validation rejection as an RPC error', async () => {
      const response = await call(
        'UteamupWorkorderQuickClose',
        { ...validArgs, resolutionNote: 'ab' }, // too short
        errorReply(422, 'ResolutionNote must be at least 3 characters.'),
      );
      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
    });

    test('surfaces a 404 when the template is gone / not quick-close', async () => {
      const response = await call(
        'UteamupWorkorderQuickClose',
        validArgs,
        errorReply(404, 'Template not available.'),
      );
      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
    });
  });

  // ── Shared error-path tests (401/503/JSON-RPC compliance) ────────────────
  const errorPathTools = [
    { name: 'UteamupWorkorderQuickClose', args: validArgs },
  ];
  describeJsonRpcCompliance(call, errorPathTools);
  describe401Unauthorized(BASE_URL, errorPathTools);
  describe503ServiceUnavailable(BASE_URL, errorPathTools);
});
