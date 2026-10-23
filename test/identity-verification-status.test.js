/**
 * Identity verification status MCP tool test.
 *
 * Covers UteamupIdentityVerificationStatus, the read-only electronic-ID (rafræn skilríki) status
 * of the signed-in user. Per MCPGuidelines.md: success, not verified, error, JSON-RPC 2.0
 * compliance, 401/503 handling, and a regression guard that the tool takes NO user or tenant
 * argument (identity comes from the Bearer token) and never returns a plain national ID.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Identity Verification Status MCP Tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_identity_status';
  const TOOL = 'UteamupIdentityVerificationStatus';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const verified = {
    verified: true,
    verifiedAt: '2026-10-23T12:00:00Z',
    provider: 'Audkenni',
    assuranceLevel: 'http://eidas.europa.eu/LoA/high',
    country: 'IS',
    maskedNationalId: '******-2989',
    linked: true,
    available: true,
  };

  test('success: returns the verified status with the masked national ID only', async () => {
    const response = await call(TOOL, {}, successReply(verified));
    expect(response.status).toBe(200);
    const text = response.body.result.content[0].text;
    const data = JSON.parse(text);
    expect(data.verified).toBe(true);
    expect(data.maskedNationalId).toBe('******-2989');
    expect(text).not.toMatch(/\d{6}-?\d{4}/);
  });

  test('not verified: returns verified false and no identity details', async () => {
    const response = await call(TOOL, {}, successReply({ verified: false, linked: false, available: false }));
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.verified).toBe(false);
    expect(data.maskedNationalId).toBeUndefined();
  });

  test('error: a backend JSON-RPC error is surfaced without crashing the proxy', async () => {
    const response = await call(TOOL, {}, errorReply(-32002, 'User not found for API key'));
    expect(response.status).toBe(200);
    expect(response.body.error.code).toBe(-32002);
  });

  test('regression: the arguments object is empty (no userId or tenantId can be supplied)', async () => {
    let captured = null;
    nock(BASE_URL)
      .post('/mcp', body => { captured = body; return true; })
      .reply(200, JSON.stringify({ jsonrpc: '2.0', result: { content: [{ type: 'text', text: '{}' }] }, id: 1 }), {
        'Content-Type': 'application/json',
      });
    await _callMcpTool(BASE_URL, ACCESS_TOKEN, TOOL, {}, successReply({}));
    expect(captured).not.toBeNull();
    expect(captured.params.name).toBe(TOOL);
    expect(captured.params.arguments).toEqual({});
  });

  const ALL_TOOLS = [{ name: TOOL, args: {} }];

  describeJsonRpcCompliance(call, ALL_TOOLS);
  describe401Unauthorized(BASE_URL, ALL_TOOLS);
  describe503ServiceUnavailable(BASE_URL, ALL_TOOLS);
});
