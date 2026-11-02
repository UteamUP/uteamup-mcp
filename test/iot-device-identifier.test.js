'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('IoT device metadata identifier update', () => {
  const BASE_URL = 'https://api.test.com';
  const guid = '11111111-1111-4111-8111-111111111111';
  const name = 'UteamupIoTDeviceUpdate';
  const args = { deviceGuid: guid, deviceId: 'proxmox-8447097bd4f7' };
  const call = (tool, input, reply) => callMcpTool(BASE_URL, 'test-token', tool, input, reply, input);
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('forwards only the new label while preserving the public GUID and active state', async () => {
    const reply = await call(name, args, successReply({ externalGuid: guid, deviceId: args.deviceId, isActive: true }));
    const device = JSON.parse(reply.body.result.content[0].text);
    expect(device.externalGuid).toBe(guid);
    expect(device.deviceId).toBe(args.deviceId);
    expect(device.isActive).toBe(true);
    expect(args).not.toHaveProperty('deviceSecret');
  });

  test('preserves a duplicate-identifier refusal', async () => {
    const reply = await call(name, args, errorReply(-32603, 'invalid_state: The device identifier is already in use.'));
    expect(reply.body.error.message).toBe('invalid_state: The device identifier is already in use.');
  });

  const tools = [{ name, args }];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
