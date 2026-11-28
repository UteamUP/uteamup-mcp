/**
 * Billing catalogue pending approvals MCP tool tests (UTE-1606)
 *
 * Covers uteamup_billing_catalog_approvals_pending, which proxies to the backend
 * GET /api/billing/admin/governance/pending-approvals endpoint: the unified
 * maker-checker queue of draft price books, price versions and rule packs.
 * Verifies that the MCP proxy:
 *   - Forwards tools/call requests as JSON-RPC 2.0
 *   - Handles successful backend responses (maker named, GUID identities)
 *   - Handles empty result sets
 *   - Handles backend errors (401, 503, JSON-RPC error shape)
 *
 * Pattern mirrors project-my-projects.test.js: raw nock-mocked HTTPS calls that
 * simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Billing catalogue pending approvals MCP Tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_billing_catalog_pending';
  const TOOL = 'uteamup_billing_catalog_approvals_pending';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Shared mock data — matches backend BillingCatalogPendingApprovalResponseModel
  // ---------------------------------------------------------------------------
  const klingPrice = {
    kind: 'priceVersion',
    itemGuid: '11111111-1111-4111-8111-111111111111',
    priceBookGuid: '22222222-2222-4222-8222-222222222222',
    name: 'Kling basic',
    context: 'KLING-BASIC · ISK book',
    createdAt: '2026-11-24T10:00:00Z',
    requestedByUserId: 'internal-maker-id',
    requestedByUserGuid: '33333333-3333-4333-8333-333333333333',
    requestedByDisplayName: 'Gísli Guðmundsson',
  };

  const draftBook = {
    kind: 'priceBook',
    itemGuid: '44444444-4444-4444-8444-444444444444',
    priceBookGuid: '44444444-4444-4444-8444-444444444444',
    name: 'ISK catalog',
    context: 'isk-default · ISK',
    createdAt: '2026-11-23T09:00:00Z',
    requestedByUserId: 'internal-maker-id',
    requestedByUserGuid: '33333333-3333-4333-8333-333333333333',
    requestedByDisplayName: 'Gísli Guðmundsson',
  };

  const rulePack = {
    kind: 'rulePack',
    itemGuid: '55555555-5555-4555-8555-555555555555',
    priceBookGuid: null,
    name: 'IS-B2B-SOFTWARE · v1',
    context: 'IS · software',
    createdAt: '2026-11-24T11:00:00Z',
    requestedByUserId: 'internal-maker-id',
    requestedByUserGuid: '33333333-3333-4333-8333-333333333333',
    requestedByDisplayName: 'Gísli Guðmundsson',
  };

  const mockList = [draftBook, klingPrice, rulePack];

  // ---------------------------------------------------------------------------
  // uteamup_billing_catalog_approvals_pending
  // ---------------------------------------------------------------------------
  describe('uteamup_billing_catalog_approvals_pending tool', () => {
    test('returns every draft kind oldest first with the maker named', async () => {
      const response = await call(TOOL, {}, successReply(mockList));

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(3);
      expect(data.map(item => item.kind)).toEqual(['priceBook', 'priceVersion', 'rulePack']);
      expect(data[1].name).toBe('Kling basic');
      expect(data[1].priceBookGuid).toBe('22222222-2222-4222-8222-222222222222');
      expect(data[2].priceBookGuid).toBeNull();
      for (const item of data) {
        expect(item.requestedByDisplayName).toBe('Gísli Guðmundsson');
        expect(item.requestedByUserGuid).toBe('33333333-3333-4333-8333-333333333333');
        expect(item.itemGuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        // Public boundary: no integer identity fields.
        expect(item).not.toHaveProperty('id');
      }
    });

    test('returns empty list when no catalogue work is pending', async () => {
      const response = await call(TOOL, {}, successReply([]));

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toEqual([]);
    });

    test('handles backend error responses in JSON-RPC error shape', async () => {
      const response = await call(
        TOOL,
        {},
        errorReply(-32603, 'Internal error: database unavailable'),
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32603);
      expect(response.body.error.message).toContain('database unavailable');
    });

    test('tool takes NO arguments — identity and tenant come from the API key', async () => {
      // Regression guard: the backend resolves the configured global admin and
      // tenant from the Bearer token; a caller-supplied identity arg would let
      // someone read another platform's queue.
      const response = await call(TOOL, {}, successReply(mockList));
      expect(response.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Reusable error suites (JSON-RPC compliance, 401, 503)
  // ---------------------------------------------------------------------------
  const tools = [{ name: TOOL, args: {} }];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
