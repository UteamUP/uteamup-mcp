/**
 * UteamupIoTDeviceArchive and UteamupIoTDeviceRestore MCP tool tests.
 *
 * Backend tools: ArchiveIoTDeviceCommand / RestoreIoTDeviceCommand + IoTDeviceArchiveCommandHandler.
 * An IoT device with readings or alerts is marked inactive instead of deleted: ingestion refuses its keys and
 * data, lists and pickers leave it out (UteamupIoTDevicesList isActive=false lists it), and its sensors,
 * readings, alerts and keys stay. Reactivate brings it back. Both need IOT.Delete, like the device delete.
 *
 * Generic-proxy pattern (nock-mocked backend; no real network).
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('IoT device archive MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_iot_device_archive';

  const DEVICE = 'dddddddd-0000-4000-8000-000000000001';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (tool, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, tool, toolArgs, mockReply, toolArgs);

  it('marks a device inactive and returns its state', async () => {
    const response = await call(
      'UteamupIoTDeviceArchive',
      { deviceGuid: DEVICE },
      successReply({ deviceGuid: DEVICE, isActive: false, updatedAt: '2026-11-06T12:00:00Z' }),
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.deviceGuid).toBe(DEVICE);
    expect(data.isActive).toBe(false);
    expect(data.updatedAt).toBeTruthy();
  });

  it('reactivates an inactive device', async () => {
    const response = await call(
      'UteamupIoTDeviceRestore',
      { deviceGuid: DEVICE },
      successReply({ deviceGuid: DEVICE, isActive: true, updatedAt: '2026-11-06T12:05:00Z' }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.isActive).toBe(true);
  });

  it('lists only inactive devices when isActive is false', async () => {
    const response = await call(
      'UteamupIoTDevicesList',
      { isActive: false },
      successReply({ items: [{ externalGuid: DEVICE, isActive: false }], totalItems: 1, page: 1, pageSize: 25 }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].isActive).toBe(false);
  });

  it('surfaces a missing IOT.Delete right as a JSON-RPC error', async () => {
    const response = await call(
      'UteamupIoTDeviceArchive',
      { deviceGuid: DEVICE },
      errorReply(-32000, 'Permission denied: IOT.Delete required'),
    );

    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/IOT\.Delete/);
  });

  it('surfaces a device outside the tenant as not_found', async () => {
    const response = await call(
      'UteamupIoTDeviceRestore',
      { deviceGuid: DEVICE },
      errorReply(-32000, 'not_found: IoT device unavailable.'),
    );

    expect(response.body.error.message).toMatch(/not_found/);
  });

  it('surfaces a concurrent source change as device_changed', async () => {
    const response = await call(
      'UteamupIoTDeviceArchive',
      { deviceGuid: DEVICE },
      errorReply(-32000, 'device_changed: The device changed meanwhile; try again.'),
    );

    expect(response.body.error.message).toMatch(/device_changed/);
  });

  const errorTools = [
    { name: 'UteamupIoTDeviceArchive', args: { deviceGuid: DEVICE } },
    { name: 'UteamupIoTDeviceRestore', args: { deviceGuid: DEVICE } },
  ];
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
