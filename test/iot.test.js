'use strict';

const nock = require('nock');
const { callMcpTool: callTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('IoT MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_iot';
  const call = (name, args, reply) => callTool(BASE_URL, ACCESS_TOKEN, name, args, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('returns portable environment state without accepting a spoofed tenant argument', async () => {
    const response = await call('UteamupIoTEnvironmentStatus', {}, successReply({
      isEnabled: true,
      status: 'Active',
      environment: {
        environmentGuid: '11111111-1111-4111-8111-111111111111',
        cloudProvider: 'azure',
        region: 'northeurope',
        portabilityStatus: 'PortablePostgreSqlOci',
      },
    }));
    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.status).toBe('Active');
    expect(result.environment.environmentGuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.environment).not.toHaveProperty('id');
  });

  test('returns monitoring and empty rules safely', async () => {
    const monitoring = await call('UteamupIoTMonitoringDashboard', {}, successReply({
      totalDevices: 10, onlineDevices: 9, criticalAlerts: 1,
    }));
    expect(JSON.parse(monitoring.body.result.content[0].text).onlineDevices).toBe(9);
    const rules = await call('UteamupIoTRulesList', {}, successReply([]));
    expect(JSON.parse(rules.body.result.content[0].text)).toEqual([]);
  });

  test('forwards bounded GUID telemetry filters verbatim', async () => {
    const args = {
      deviceGuid: '22222222-2222-4222-8222-222222222222',
      from: '2026-07-01T00:00:00Z',
      to: '2026-07-02T00:00:00Z',
      limit: 25,
    };
    const response = await call('UteamupIoTTelemetryPoints', args, successReply({ items: [] }));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text).items).toEqual([]);
  });

  test('preserves backend JSON-RPC errors', async () => {
    const response = await call(
      'UteamupIoTMonitoringDashboard', {}, errorReply(-32603, 'IoT stamp unavailable'));
    expect(response.body.error.message).toContain('stamp unavailable');
  });

  const tools = [
    { name: 'UteamupIoTEnvironmentStatus', args: {} },
    { name: 'UteamupIoTMonitoringDashboard', args: {} },
    { name: 'UteamupIoTTelemetryPoints', args: { limit: 25 } },
    { name: 'UteamupIoTRulesList', args: {} },
  ];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
