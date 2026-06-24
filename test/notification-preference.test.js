/**
 * Workorder Notification Preference MCP tool tests.
 *
 * Covers the two MCP tools that proxy to the backend per-user workorder
 * notification-preference endpoint (GET|PUT /api/notificationpreference):
 *   - UteamupNotificationPreferenceGet
 *   - UteamupNotificationPreferenceSet
 *
 * Covers per MCPGuidelines.md: success, empty/defaults, error, JSON-RPC 2.0
 * compliance, 401/503 handling, argument round-trip, and a regression guard that
 * the user-scoped tools take NO userId/tenantId args (identity + tenant come from
 * the Bearer token / API key context).
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Workorder Notification Preference MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_notification_preference';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ── Shared mock data ─────────────────────────────────────────────────────
  const prefs = {
    guid: '11111111-1111-1111-1111-111111111111',
    tenantGuid: '22222222-2222-2222-2222-222222222222',
    dueDateWindowStartHours: 24,
    dueDateWindowEndHours: 1,
    startDateWindowStartHours: 24,
    startDateWindowEndHours: 1,
    notifyOnDueDate: true,
    notifyOnStartDate: true,
    notifyOnChange: true,
    notifyOnComment: true,
  };

  // ── UteamupNotificationPreferenceGet ─────────────────────────────────────
  describe('UteamupNotificationPreferenceGet', () => {
    test('success: returns the persisted preferences', async () => {
      const response = await call('UteamupNotificationPreferenceGet', {}, successReply(prefs));
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.dueDateWindowStartHours).toBe(24);
      expect(data.notifyOnComment).toBe(true);
    });

    test('defaults: backend returns the all-enabled 24h->1h defaults when no row exists', async () => {
      const response = await call('UteamupNotificationPreferenceGet', {}, successReply(prefs));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.dueDateWindowStartHours).toBe(24);
      expect(data.dueDateWindowEndHours).toBe(1);
      expect(data.notifyOnDueDate).toBe(true);
    });

    test('error: JSON-RPC error shape is surfaced without crashing the proxy', async () => {
      const response = await call('UteamupNotificationPreferenceGet', {}, errorReply(-32002, 'User not found'));
      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32002);
    });
  });

  // ── UteamupNotificationPreferenceSet ─────────────────────────────────────
  describe('UteamupNotificationPreferenceSet', () => {
    test('success: partial update returns the merged preferences', async () => {
      const updated = { ...prefs, notifyOnComment: false, dueDateWindowStartHours: 12 };
      const response = await call(
        'UteamupNotificationPreferenceSet',
        { notifyOnComment: false, dueDateWindowStartHours: 12 },
        successReply(updated),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.notifyOnComment).toBe(false);
      expect(data.dueDateWindowStartHours).toBe(12);
      expect(data.notifyOnDueDate).toBe(true); // unchanged
    });

    test('argument round-trip: non-default args are forwarded verbatim', async () => {
      let capturedBody = null;
      nock(BASE_URL)
        .post('/mcp', body => {
          if (body.method === 'tools/call' && body.params?.name === 'UteamupNotificationPreferenceSet') {
            capturedBody = body;
            return true;
          }
          return false;
        })
        .reply(200, JSON.stringify({ jsonrpc: '2.0', result: { content: [{ type: 'text', text: JSON.stringify(prefs) }] }, id: 1 }), {
          'Content-Type': 'application/json',
        });

      const https = require('https');
      const payload = JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupNotificationPreferenceSet',
          arguments: {
            dueDateWindowStartHours: 18,
            dueDateWindowEndHours: 2,
            startDateWindowStartHours: 12,
            startDateWindowEndHours: 1,
            notifyOnDueDate: false,
            notifyOnStartDate: true,
            notifyOnChange: false,
            notifyOnComment: true,
          },
        },
        id: 1,
      });
      await new Promise((resolve, reject) => {
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
          rejectUnauthorized: false,
        }, (res) => { res.on('data', () => {}); res.on('end', resolve); });
        req.on('error', reject);
        req.write(payload);
        req.end();
      });

      expect(capturedBody).not.toBeNull();
      expect(capturedBody.params.arguments).toEqual({
        dueDateWindowStartHours: 18,
        dueDateWindowEndHours: 2,
        startDateWindowStartHours: 12,
        startDateWindowEndHours: 1,
        notifyOnDueDate: false,
        notifyOnStartDate: true,
        notifyOnChange: false,
        notifyOnComment: true,
      });
    });

    test('error: validation error from backend (end >= start window) surfaces cleanly', async () => {
      const response = await call(
        'UteamupNotificationPreferenceSet',
        { dueDateWindowStartHours: 5, dueDateWindowEndHours: 10 },
        errorReply(-32602, 'DueDateWindowEndHours must be less than DueDateWindowStartHours.'),
      );
      expect(response.body.error.code).toBe(-32602);
    });
  });

  // ── Regression guard: user-scoped tools take no userId/tenantId args ─────
  //     (Identity + tenant come from the API key context. Adding userId/tenantId
  //      args would invite cross-user / cross-tenant spoofing.)
  describe('Regression guards', () => {
    test('UteamupNotificationPreferenceGet — arguments object is empty {} (no userId/tenantId sneaking in)', async () => {
      let captured = null;
      nock(BASE_URL)
        .post('/mcp', body => { captured = body; return true; })
        .reply(200, JSON.stringify({ jsonrpc: '2.0', result: { content: [{ type: 'text', text: '{}' }] }, id: 1 }), {
          'Content-Type': 'application/json',
        });
      await _callMcpTool(BASE_URL, ACCESS_TOKEN, 'UteamupNotificationPreferenceGet', {}, successReply({}));
      expect(captured).not.toBeNull();
      expect(captured.params.arguments).toEqual({});
    });
  });

  // ── Standard suites from MCPGuidelines: JSON-RPC / 401 / 503 ─────────────
  const ALL_TOOLS = [
    { name: 'UteamupNotificationPreferenceGet', args: {} },
    { name: 'UteamupNotificationPreferenceSet', args: { notifyOnComment: false } },
  ];

  describeJsonRpcCompliance(call, ALL_TOOLS);
  describe401Unauthorized(BASE_URL, ALL_TOOLS);
  describe503ServiceUnavailable(BASE_URL, ALL_TOOLS);
});
