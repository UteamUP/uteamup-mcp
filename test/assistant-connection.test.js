/**
 * Assistant connection MCP tool tests
 *
 * Covers UteamupAssistantConnectionList and UteamupAssistantConnectionRevoke, the tenant-admin tools
 * (Tenant.Update) for external AI assistants that members linked by signing in. Verifies the proxy
 * forwards tools/call as JSON-RPC 2.0, round-trips results and errors, and forwards the grant GUID as-is.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Assistant connection MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_assistant_connections';
  const GRANT_GUID = '5b1f9d0a-2c3e-4f5a-8b6c-7d8e9f0a1b2c';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // Matches backend McpOAuthGrantResponse
  const grokLink = {
    grantGuid: GRANT_GUID,
    clientName: 'Grok',
    redirectHost: 'grok.com',
    tenantGuid: '1e6ee237-c73a-4d76-8a7f-d9431a66a68d',
    tenantName: 'UteamUP',
    userDisplayName: 'Demo User',
    scope: 'mcp:read',
    createdAt: '2026-10-01T10:00:00Z',
    lastUsedAt: '2026-10-15T10:00:00Z',
  };

  describe('UteamupAssistantConnectionList tool', () => {
    test('returns the tenant links with GUIDs and the read-only scope', async () => {
      const response = await call('UteamupAssistantConnectionList', {}, successReply([grokLink]));

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(1);
      expect(data[0].grantGuid).toBe(GRANT_GUID);
      expect(data[0].scope).toBe('mcp:read');
      expect(data[0]).not.toHaveProperty('id');
    });

    test('returns an empty list when no member has linked an assistant', async () => {
      const response = await call('UteamupAssistantConnectionList', {}, successReply([]));

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
    });

    test('surfaces a permission error without crashing the proxy', async () => {
      const response = await call(
        'UteamupAssistantConnectionList',
        {},
        errorReply(-32603, 'Permission denied: Tenant.Update required'),
      );

      expect(response.body.error.code).toBe(-32603);
      expect(response.body.error.message).toContain('Tenant.Update');
    });

    test('takes no tenant or user arguments; both come from the token', async () => {
      const response = await call('UteamupAssistantConnectionList', {}, successReply([grokLink]));
      expect(response.status).toBe(200);
    });
  });

  describe('UteamupAssistantConnectionRevoke tool', () => {
    test('forwards the grant GUID verbatim and returns true when revoked', async () => {
      // The mock only matches when the proxy forwards exactly these arguments.
      const response = await _callMcpTool(
        BASE_URL, ACCESS_TOKEN, 'UteamupAssistantConnectionRevoke',
        { grantGuid: GRANT_GUID }, successReply(true), { grantGuid: GRANT_GUID },
      );

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body.result.content[0].text)).toBe(true);
    });

    test('returns false for a link that does not exist in the tenant', async () => {
      const response = await call('UteamupAssistantConnectionRevoke', { grantGuid: GRANT_GUID }, successReply(false));

      expect(JSON.parse(response.body.result.content[0].text)).toBe(false);
    });
  });

  const tools = [
    { name: 'UteamupAssistantConnectionList', args: {} },
    { name: 'UteamupAssistantConnectionRevoke', args: { grantGuid: GRANT_GUID } },
  ];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
