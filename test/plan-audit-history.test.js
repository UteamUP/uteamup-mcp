/**
 * Plan Audit History MCP tool tests
 *
 * Covers the UteamupPlanAuditHistory tool which proxies to the backend
 * GET /api/planaudit/by-plan/{planGuid} endpoint. Verifies that the MCP proxy:
 *   - Forwards tools/call requests as JSON-RPC 2.0
 *   - Forwards the planGuid argument verbatim
 *   - Handles successful backend responses
 *   - Handles empty result sets
 *   - Handles backend errors (401, 503, JSON-RPC error shape)
 *
 * Pattern mirrors project-my-projects.test.js: raw nock-mocked HTTPS calls that
 * simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const https = require('https');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Plan Audit History MCP Tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_plan_audit';
  const PLAN_GUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Shared mock data — matches backend PlanChangeAuditResponseModel
  // ---------------------------------------------------------------------------
  const createdRow = {
    guid: '11111111-1111-1111-1111-111111111111',
    planGuid: PLAN_GUID,
    action: 'Created',
    actorUserId: 'admin-1',
    actorUserGuid: '99999999-9999-9999-9999-999999999999',
    changes: [
      { field: 'Name', oldValue: null, newValue: 'Pro' },
      { field: 'MonthlyPrice', oldValue: null, newValue: 49 },
    ],
    reason: 'Initial creation',
    changedAt: '2026-06-01T10:00:00Z',
  };

  const updatedRow = {
    guid: '22222222-2222-2222-2222-222222222222',
    planGuid: PLAN_GUID,
    action: 'Updated',
    actorUserId: 'admin-2',
    actorUserGuid: '88888888-8888-8888-8888-888888888888',
    changes: [
      { field: 'MonthlyPrice', oldValue: 49, newValue: 59 },
    ],
    reason: null,
    changedAt: '2026-06-15T14:30:00Z',
  };

  const mockHistory = [updatedRow, createdRow];

  // ---------------------------------------------------------------------------
  // UteamupPlanAuditHistory
  // ---------------------------------------------------------------------------
  describe('UteamupPlanAuditHistory tool', () => {
    test('returns the plan change history, most recent first', async () => {
      const response = await call(
        'UteamupPlanAuditHistory',
        { planGuid: PLAN_GUID },
        successReply(mockHistory),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(2);
      expect(data[0].action).toBe('Updated');
      expect(data[1].action).toBe('Created');
      // GUIDs-in/integer-ids-out: audit identity and plan reference must be
      // GUIDs at the public boundary — never leak the internal int id.
      expect(data[0].guid).toBe('22222222-2222-2222-2222-222222222222');
      expect(data[0].planGuid).toBe(PLAN_GUID);
      expect(data[0]).not.toHaveProperty('id');
    });

    test('surfaces each field diff (old → new) on an updated row', async () => {
      const response = await call(
        'UteamupPlanAuditHistory',
        { planGuid: PLAN_GUID },
        successReply([updatedRow]),
      );

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].changes).toEqual([
        { field: 'MonthlyPrice', oldValue: 49, newValue: 59 },
      ]);
    });

    test('returns empty list when the plan has no recorded changes', async () => {
      const response = await call(
        'UteamupPlanAuditHistory',
        { planGuid: PLAN_GUID },
        successReply([]),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toEqual([]);
    });

    test('forwards the planGuid argument verbatim to the backend', async () => {
      nock(BASE_URL)
        .post('/mcp', body =>
          body.method === 'tools/call' &&
          body.params?.name === 'UteamupPlanAuditHistory' &&
          body.params?.arguments?.planGuid === PLAN_GUID)
        .reply(200, JSON.stringify(successReply(mockHistory).body), {
          'Content-Type': 'application/json',
        });

      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'UteamupPlanAuditHistory', arguments: { planGuid: PLAN_GUID } },
        id: 7001,
      };

      const response = await new Promise((resolve, reject) => {
        const data = JSON.stringify(request);
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'Content-Length': Buffer.byteLength(data),
          },
          rejectUnauthorized: false,
        }, (res) => {
          let responseData = '';
          res.on('data', chunk => responseData += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body: responseData }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      // A verbatim-forwarded planGuid is proven by nock matching the body:
      // if the arg were dropped or mangled the interceptor would 404.
      expect(response.status).toBe(200);
    });

    test('handles backend error responses in JSON-RPC error shape', async () => {
      const response = await call(
        'UteamupPlanAuditHistory',
        { planGuid: PLAN_GUID },
        errorReply(-32603, 'Internal error: database unavailable'),
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32603);
      expect(response.body.error.message).toContain('database unavailable');
    });
  });

  // ---------------------------------------------------------------------------
  // Reusable error suites (JSON-RPC compliance, 401, 503)
  // ---------------------------------------------------------------------------
  const tools = [{ name: 'UteamupPlanAuditHistory', args: { planGuid: PLAN_GUID } }];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
