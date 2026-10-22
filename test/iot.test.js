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
      totalDevices: 10,
      onlineDevices: 9,
      criticalAlerts: 1,
      stampDiagnosticsAvailable: true,
      pendingProjectionEvents: 4,
      deadLetterBacklog: 1,
    }));
    const dashboard = JSON.parse(monitoring.body.result.content[0].text);
    expect(dashboard.onlineDevices).toBe(9);
    expect(dashboard.stampDiagnosticsAvailable).toBe(true);
    expect(dashboard.pendingProjectionEvents).toBe(4);
    expect(dashboard.deadLetterBacklog).toBe(1);
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

  const DEVICE_GUID = '33333333-3333-4333-8333-333333333333';
  const KEY_GUID = '44444444-4444-4444-8444-444444444444';

  test('creates a device by type GUID and returns GUIDs only', async () => {
    const args = {
      name: 'Stofa smart plug',
      deviceId: 'switch.stofa_plug',
      deviceTypeGuid: '55555555-5555-4555-8555-555555555555',
    };
    const response = await call('UteamupIoTDeviceCreate', args, successReply({
      externalGuid: DEVICE_GUID, name: args.name, deviceId: args.deviceId, status: 'Offline', isActive: true,
    }));
    const device = JSON.parse(response.body.result.content[0].text);
    expect(device.externalGuid).toBe(DEVICE_GUID);
    expect(device).not.toHaveProperty('id');
  });

  test('issues a device key whose secret is returned once and lists keys without it', async () => {
    const issued = await call('UteamupIoTDeviceKeyIssue', { deviceGuid: DEVICE_GUID, name: 'Home Assistant' }, successReply({
      externalGuid: KEY_GUID, deviceGuid: DEVICE_GUID, name: 'Home Assistant', apiKey: 'iot_secret_value', keyPrefix: 'iot_secr',
    }));
    expect(JSON.parse(issued.body.result.content[0].text).apiKey).toBe('iot_secret_value');

    const listed = await call('UteamupIoTDeviceKeysList', { deviceGuid: DEVICE_GUID }, successReply([
      { externalGuid: KEY_GUID, deviceGuid: DEVICE_GUID, name: 'Home Assistant', keyPrefix: 'iot_secr', isActive: true },
    ]));
    const keys = JSON.parse(listed.body.result.content[0].text);
    expect(keys[0]).not.toHaveProperty('apiKey');
    expect(keys[0].keyPrefix).toBe('iot_secr');
  });

  test('revokes a key by GUID and surfaces a permission refusal from the backend', async () => {
    const revoked = await call('UteamupIoTDeviceKeyRevoke', { apiKeyGuid: KEY_GUID }, successReply({ apiKeyGuid: KEY_GUID, revoked: true }));
    expect(JSON.parse(revoked.body.result.content[0].text).revoked).toBe(true);

    const refused = await call(
      'UteamupIoTDeviceKeyRevoke', { apiKeyGuid: KEY_GUID }, errorReply(-32603, 'permission_denied: Permission denied: IOT.Delete required.'));
    expect(refused.body.error.message).toContain('IOT.Delete');
  });

  const tools = [
    { name: 'UteamupIoTEnvironmentStatus', args: {} },
    { name: 'UteamupIoTMonitoringDashboard', args: {} },
    { name: 'UteamupIoTTelemetryPoints', args: { limit: 25 } },
    { name: 'UteamupIoTRulesList', args: {} },
    { name: 'UteamupIoTDeviceTypesList', args: {} },
    { name: 'UteamupIoTDevicesList', args: { search: 'plug', page: 1, pageSize: 25 } },
    { name: 'UteamupIoTDeviceGet', args: { deviceGuid: '33333333-3333-4333-8333-333333333333' } },
    { name: 'UteamupIoTDeviceUpdate', args: { deviceGuid: '33333333-3333-4333-8333-333333333333', firmwareVersion: '2.1' } },
    { name: 'UteamupIoTDeviceKeysList', args: { deviceGuid: '33333333-3333-4333-8333-333333333333' } },
  ];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
