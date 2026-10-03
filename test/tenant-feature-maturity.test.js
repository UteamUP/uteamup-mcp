/**
 * Tenant feature level MCP tool tests.
 *
 * Covers the two tools that read and set the organization's web and mobile app feature levels
 * (0 = General, 1 = Preview, 2 = Beta, 3 = Internal):
 *   - UteamupTenantFeatureMaturityGet  (Tenant.View)
 *   - UteamupTenantFeatureMaturitySet  (Tenant.Update)
 *
 * Covers per MCPGuidelines.md: success, empty, error, JSON-RPC 2.0 compliance, 401/503
 * handling, argument round-trip, and a regression guard that the tools take no tenant
 * identifier (the tenant comes from the API key).
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Tenant feature level MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_tenant_feature_maturity';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  describe('UteamupTenantFeatureMaturityGet', () => {
    test('success: returns the effective web and mobile levels', async () => {
      const response = await call(
        'UteamupTenantFeatureMaturityGet',
        {},
        successReply({ maxFeatureMaturity: 2, mobileMaxFeatureMaturity: 1 }),
        {},
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toEqual({ maxFeatureMaturity: 2, mobileMaxFeatureMaturity: 1 });
    });

    test('empty: a General-only tenant reports zeros', async () => {
      const response = await call(
        'UteamupTenantFeatureMaturityGet',
        {},
        successReply({ maxFeatureMaturity: 0, mobileMaxFeatureMaturity: 0 }),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.mobileMaxFeatureMaturity).toBe(0);
    });

    test('error: a permission error surfaces without crashing the proxy', async () => {
      const response = await call('UteamupTenantFeatureMaturityGet', {}, errorReply(-32003, 'Tenant.View required'));
      expect(response.status).toBe(200);
      expect(response.body.error.code).toBe(-32003);
    });
  });

  describe('UteamupTenantFeatureMaturitySet', () => {
    test('argument round-trip: web and mobile levels are forwarded verbatim', async () => {
      const response = await call(
        'UteamupTenantFeatureMaturitySet',
        { maxFeatureMaturity: 2, mobileMaxFeatureMaturity: 1 },
        successReply({ maxFeatureMaturity: 2, mobileMaxFeatureMaturity: 1 }),
        { maxFeatureMaturity: 2, mobileMaxFeatureMaturity: 1 },
      );
      expect(response.status).toBe(200);
      expect(JSON.parse(response.body.result.content[0].text).mobileMaxFeatureMaturity).toBe(1);
    });

    test('omitted mobile level: only the web level is sent', async () => {
      const response = await call(
        'UteamupTenantFeatureMaturitySet',
        { maxFeatureMaturity: 1 },
        successReply({ maxFeatureMaturity: 1, mobileMaxFeatureMaturity: 1 }),
        { maxFeatureMaturity: 1 },
      );
      expect(response.status).toBe(200);
    });

    test('error: a mobile level above the web level is rejected', async () => {
      const response = await call(
        'UteamupTenantFeatureMaturitySet',
        { maxFeatureMaturity: 1, mobileMaxFeatureMaturity: 2 },
        errorReply(-32602, 'The mobile app level cannot be higher than the web level.'),
      );
      expect(response.body.error.code).toBe(-32602);
      expect(response.body.result).toBeUndefined();
    });

    test('error: Internal by a user who is not a configured global admin is refused', async () => {
      const response = await call(
        'UteamupTenantFeatureMaturitySet',
        { maxFeatureMaturity: 3, mobileMaxFeatureMaturity: 3 },
        errorReply(-32003, 'Only global admins can open Internal features to a tenant'),
      );
      expect(response.body.error.code).toBe(-32003);
    });

    test('error: an out-of-range level is rejected', async () => {
      const response = await call(
        'UteamupTenantFeatureMaturitySet',
        { maxFeatureMaturity: 4 },
        errorReply(-32602, 'maxFeatureMaturity must be between 0 and 3.'),
      );
      expect(response.body.error.code).toBe(-32602);
    });
  });

  describe('Regression guards', () => {
    test('Get takes no arguments, so no tenant identifier can be supplied', async () => {
      let captured = null;
      nock(BASE_URL)
        .post('/mcp', body => { captured = body; return true; })
        .reply(200, JSON.stringify({ jsonrpc: '2.0', result: { content: [{ type: 'text', text: '{}' }] }, id: 1 }), {
          'Content-Type': 'application/json',
        });
      await _callMcpTool(BASE_URL, ACCESS_TOKEN, 'UteamupTenantFeatureMaturityGet', {}, successReply({}));
      expect(captured.params.arguments).toEqual({});
    });
  });

  const ALL_TOOLS = [
    { name: 'UteamupTenantFeatureMaturityGet', args: {} },
    { name: 'UteamupTenantFeatureMaturitySet', args: { maxFeatureMaturity: 1, mobileMaxFeatureMaturity: 0 } },
  ];

  describeJsonRpcCompliance(call, ALL_TOOLS);
  describe401Unauthorized(BASE_URL, ALL_TOOLS);
  describe503ServiceUnavailable(BASE_URL, ALL_TOOLS);
});
