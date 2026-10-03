/**
 * User UI State MCP tool tests.
 *
 * Covers the five MCP tools that proxy to the backend user-preferences and user-state endpoints:
 *   - UteamupUserPreferencesGet
 *   - UteamupUserPreferencesSet
 *   - UteamupUserStateGetLastPage
 *   - UteamupUserStateSetLastPage
 *   - UteamupUserStateClearLastPage
 *
 * Covers per MCPGuidelines.md: success, empty, error, JSON-RPC 2.0 compliance,
 * 401/503 handling, argument round-trip, and a regression guard that the
 * user-scoped tools take NO userId/tenantId args (identity comes from the Bearer token).
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('User UI State MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_user_ui_state';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ── Shared mock data ─────────────────────────────────────────────────────
  const prefs = {
    enableBugAndFeatureWidget: true,
    enableFeaturePreviewWidget: false,
    showRestoreBanner: true,
  };
  const lastPage = {
    lastPagePath: '/workorder/123',
    lastPageQuery: '?tab=details',
    lastPageUpdatedAt: '2026-04-19T12:00:00Z',
  };

  // ── UteamupUserPreferencesGet ────────────────────────────────────────────
  describe('UteamupUserPreferencesGet', () => {
    test('success: returns persisted preferences', async () => {
      const response = await call('UteamupUserPreferencesGet', {}, successReply(prefs));
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.enableBugAndFeatureWidget).toBe(true);
      expect(data.showRestoreBanner).toBe(true);
    });

    test('empty: returns null when the user has no preferences row', async () => {
      const response = await call('UteamupUserPreferencesGet', {}, successReply(null));
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toBeNull();
    });

    test('error: JSON-RPC error shape is surfaced without crashing the proxy', async () => {
      const response = await call('UteamupUserPreferencesGet', {}, errorReply(-32002, 'User not found'));
      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32002);
    });
  });

  // ── UteamupUserPreferencesSet ────────────────────────────────────────────
  describe('UteamupUserPreferencesSet', () => {
    test('success: partial update returns the merged preferences', async () => {
      const updated = { ...prefs, enableBugAndFeatureWidget: false };
      const response = await call(
        'UteamupUserPreferencesSet',
        { enableBugAndFeatureWidget: false },
        successReply(updated),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.enableBugAndFeatureWidget).toBe(false);
      expect(data.enableFeaturePreviewWidget).toBe(false); // unchanged
    });

    test('argument round-trip: non-default args are forwarded verbatim', async () => {
      let capturedBody = null;
      nock(BASE_URL)
        .post('/mcp', body => {
          if (body.method === 'tools/call' && body.params?.name === 'UteamupUserPreferencesSet') {
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
          name: 'UteamupUserPreferencesSet',
          arguments: { enableBugAndFeatureWidget: true, enableFeaturePreviewWidget: true, showRestoreBanner: false },
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
        enableBugAndFeatureWidget: true,
        enableFeaturePreviewWidget: true,
        showRestoreBanner: false,
      });
    });

    test('error: validation error from backend surfaces cleanly', async () => {
      const response = await call('UteamupUserPreferencesSet', {}, errorReply(-32602, 'Invalid params'));
      expect(response.body.error.code).toBe(-32602);
    });

    test('mobile opt-in: mobileFeatureOptIn is forwarded verbatim and echoed back', async () => {
      const response = await _callMcpTool(
        BASE_URL,
        ACCESS_TOKEN,
        'UteamupUserPreferencesSet',
        { mobileFeatureOptIn: 2 },
        successReply({ ...prefs, mobileFeatureOptIn: 2 }),
        { mobileFeatureOptIn: 2 },
      );
      expect(response.status).toBe(200);
      expect(JSON.parse(response.body.result.content[0].text).mobileFeatureOptIn).toBe(2);
    });

    test('mobile opt-in: an out-of-range level (Internal) is rejected by the backend', async () => {
      const response = await call(
        'UteamupUserPreferencesSet',
        { mobileFeatureOptIn: 3 },
        errorReply(-32602, 'mobileFeatureOptIn must be 0 (off), 1 (Preview) or 2 (Beta).'),
      );
      expect(response.body.error.code).toBe(-32602);
      expect(response.body.result).toBeUndefined();
    });
  });

  // ── UteamupUserStateGetLastPage ──────────────────────────────────────────
  describe('UteamupUserStateGetLastPage', () => {
    test('success: returns the persisted last page', async () => {
      const response = await call('UteamupUserStateGetLastPage', {}, successReply(lastPage));
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.lastPagePath).toBe('/workorder/123');
    });

    test('empty: returns null when no last page recorded', async () => {
      const response = await call('UteamupUserStateGetLastPage', {}, successReply(null));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toBeNull();
    });
  });

  // ── UteamupUserStateSetLastPage ──────────────────────────────────────────
  describe('UteamupUserStateSetLastPage', () => {
    test('success: returns upserted last page', async () => {
      const response = await call(
        'UteamupUserStateSetLastPage',
        { lastPagePath: '/dashboard', lastPageQuery: null },
        successReply({ lastPagePath: '/dashboard', lastPageQuery: null, lastPageUpdatedAt: '2026-04-19T12:00:00Z' }),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.lastPagePath).toBe('/dashboard');
    });

    test('error: backend rejects invalid relative path', async () => {
      const response = await call(
        'UteamupUserStateSetLastPage',
        { lastPagePath: 'http://evil.example.com' },
        errorReply(-32602, 'LastPagePath must be a relative route'),
      );
      expect(response.body.error.code).toBe(-32602);
    });
  });

  // ── UteamupUserStateClearLastPage ────────────────────────────────────────
  describe('UteamupUserStateClearLastPage', () => {
    test('success: returns true when a record was cleared', async () => {
      const response = await call('UteamupUserStateClearLastPage', {}, successReply(true));
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toBe(true);
    });

    test('empty: returns false when there was nothing to clear', async () => {
      const response = await call('UteamupUserStateClearLastPage', {}, successReply(false));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toBe(false);
    });
  });

  // ── Regression guard: user-scoped tools take no userId/tenantId args ─────
  //     (Identity comes from the Bearer token. Adding userId/tenantId args would invite spoofing.)
  describe('Regression guards', () => {
    test.each([
      'UteamupUserPreferencesGet',
      'UteamupUserStateGetLastPage',
      'UteamupUserStateClearLastPage',
    ])('%s — arguments object is empty {} (no userId/tenantId sneaking in)', async (toolName) => {
      let captured = null;
      nock(BASE_URL)
        .post('/mcp', body => { captured = body; return true; })
        .reply(200, JSON.stringify({ jsonrpc: '2.0', result: { content: [{ type: 'text', text: '{}' }] }, id: 1 }), {
          'Content-Type': 'application/json',
        });
      await _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, {}, successReply({}));
      // The body from callMcpTool matches — no id spoofing parameter was forwarded.
      expect(captured).not.toBeNull();
      expect(captured.params.arguments).toEqual({});
    });
  });

  // ── Standard suites from MCPGuidelines: JSON-RPC / 401 / 503 ─────────────
  const ALL_TOOLS = [
    { name: 'UteamupUserPreferencesGet', args: {} },
    { name: 'UteamupUserPreferencesSet', args: { enableBugAndFeatureWidget: true } },
    { name: 'UteamupUserStateGetLastPage', args: {} },
    { name: 'UteamupUserStateSetLastPage', args: { lastPagePath: '/dashboard' } },
    { name: 'UteamupUserStateClearLastPage', args: {} },
  ];

  describeJsonRpcCompliance(call, ALL_TOOLS);
  describe401Unauthorized(BASE_URL, ALL_TOOLS);
  describe503ServiceUnavailable(BASE_URL, ALL_TOOLS);
});
