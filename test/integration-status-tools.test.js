'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Integration status MCP contracts', () => {
  const baseUrl = 'https://api.test.com';
  const tools = [
    { name: 'uteamup_storage_status_get', args: {}, permission: 'TenantStorage.Manage' },
    { name: 'uteamup_sharepoint_status_get', args: {}, permission: 'SharePointIntegration.Manage' },
    { name: 'uteamup_business_central_status_get', args: {}, permission: 'Tenant.Update' },
  ];
  const call = (name, args, reply) => callMcpTool(baseUrl, 'status-token', name, args, reply, {});
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test.each(tools)('$name forwards a read in the authenticated context with no identity overrides', async tool => {
    const saved = { status: 'not_validated', healthStatus: 'not_checked', isConfigured: true };
    const response = await call(tool.name, tool.args, successReply(saved));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(saved);
    expect(tool.args).toEqual({});
  });

  test('shared storage is a valid default, not a failed integration', async () => {
    const saved = { status: 'shared', storageType: 'Shared', hasDedicatedStorage: false, healthStatus: 'not_checked' };
    const response = await call(tools[0].name, {}, successReply(saved));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(saved);
  });

  test.each(tools.slice(1))('$name preserves an unconfigured state', async tool => {
    const saved = { status: 'not_configured', isConfigured: false, healthStatus: 'not_checked' };
    const response = await call(tool.name, {}, successReply(saved));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(saved);
  });

  test('SharePoint keeps last validation freshness and unknown capabilities', async () => {
    const saved = { status: 'validation_failed', lastValidatedAt: '2026-11-23T12:00:00Z', hasValidationError: true, canRead: true, canWrite: false, canUpdate: null, healthStatus: 'not_checked' };
    const response = await call(tools[1].name, {}, successReply(saved));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(saved);
  });

  test('Business Central distinguishes emulation and saved refresh time', async () => {
    const saved = { status: 'emulated', useEmulator: true, lastTestedAt: null, lastRefreshedAt: '2026-11-23T12:00:00Z', healthStatus: 'not_checked' };
    const response = await call(tools[2].name, {}, successReply(saved));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(saved);
  });

  test.each(tools)('$name preserves permission denial', async tool => {
    const response = await call(tool.name, {}, errorReply(-32603, tool.permission + ' required'));
    expect(response.body.error.message).toContain(tool.permission);
    expect(response.body.result).toBeUndefined();
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
