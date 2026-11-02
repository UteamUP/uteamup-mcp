'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

// Proxy contract only: the backend owns validation, tenant scope and normalization.
// These mocks do not connect MCP to a local or non-production service.
const BASE_URL = 'https://api.uteamup.com';
const TOKEN = 'mock-equipment-identity-token';
const assetGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const fields = {
  manufacturer: 'IKEA of Sweden', ipAddress: '192.168.68.86',
  macAddress: 'AA:BB:CC:DD:EE:FF', hostName: 'HA.LOCAL', webUrl: 'http://ha.local:8123/',
};
const canonical = { ...fields, macAddress: 'aabbccddeeff', hostName: 'ha.local' };

describe('Asset equipment identity MCP contract', () => {
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const cases = [
    ['UteamupAssetCreate', { model: { name: 'Home Assistant', ...fields } }],
    ['UteamupAssetUpdate', { id: assetGuid, model: { name: 'Home Assistant', ...fields } }],
    ['UteamupAssetPatch', { assetGuid, ...fields, expectedUpdatedAtUtc: '2026-11-02T06:00:00Z' }],
  ];
  for (const [tool, args] of cases) {
    it(`${tool} preserves the existing argument shape and all five equipment fields`, async () => {
      const response = await callMcpTool(BASE_URL, TOKEN, tool, args,
        successReply({ assetGuid, ...canonical, manufacturerVendorGuid: null }), args);
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toMatchObject(canonical);
      expect(data.manufacturerVendorGuid).toBeNull();
      expect(data).not.toHaveProperty('id');
    });
  }

  const complianceTools = cases.map(([name, args]) => ({ name, args }));
  describeJsonRpcCompliance(
    (name, args, mockReply) => callMcpTool(BASE_URL, TOKEN, name, args, mockReply),
    complianceTools,
  );
  describe401Unauthorized(BASE_URL, complianceTools);
  describe503ServiceUnavailable(BASE_URL, complianceTools);

  it('forwards an explicit empty clear while leaving other fields omitted', async () => {
    const args = { assetGuid, ipAddress: '', webUrl: '' };
    const response = await callMcpTool(BASE_URL, TOKEN, 'UteamupAssetPatch', args,
      successReply({ assetGuid, ...canonical, ipAddress: '', webUrl: '' }), args);
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.ipAddress).toBe('');
    expect(data.webUrl).toBe('');
    expect(data.manufacturer).toBe(fields.manufacturer);
  });

  for (const code of ['invalid_assignment', 'asset_changed', 'asset_not_found']) {
    it(`preserves the backend ${code} refusal without fabricating success`, async () => {
      const response = await callMcpTool(BASE_URL, TOKEN, 'UteamupAssetPatch',
        { assetGuid, ipAddress: '192.168.68.86/24' }, errorReply(-32603, `${code}: Refused`));
      expect(response.body.error.message).toContain(code);
    });
  }
});
