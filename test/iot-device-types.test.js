'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('IoT device type management', () => {
  const BASE_URL = 'https://api.test.com';
  const TYPE_GUID = '55555555-5555-4555-8555-555555555555';
  const fields = {
    name: 'IKEA KAJPLATS via Home Assistant', description: 'Matter over Thread',
    manufacturer: 'IKEA of Sweden', model: 'E27', configurationSchema: '{"type":"object"}',
  };
  const call = (name, args, reply) => callMcpTool(BASE_URL, 'test-token', name, args, reply, args);
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  for (const name of ['UteamupIoTDeviceTypeCreate', 'UteamupIoTDeviceTypeUpdate']) {
    test(`${name} forwards the complete fields and public type GUID`, async () => {
      const args = name.endsWith('Update') ? { deviceTypeGuid: TYPE_GUID, ...fields } : fields;
      const reply = await call(name, args, successReply({ externalGuid: TYPE_GUID, ...fields, deviceCount: 0 }));
      const result = JSON.parse(reply.body.result.content[0].text);
      expect(result.externalGuid).toBe(TYPE_GUID);
      expect(result.configurationSchema).toBe(fields.configurationSchema);
      expect(result.manufacturer).toBe('IKEA of Sweden');
      expect(result).not.toHaveProperty('id');
    });
  }

  test('unused deletion succeeds and in-use or foreign types retain their error', async () => {
    const args = { deviceTypeGuid: TYPE_GUID };
    const deleted = await call('UteamupIoTDeviceTypeDelete', args, successReply(true));
    expect(JSON.parse(deleted.body.result.content[0].text)).toBe(true);
    for (const message of ['invalid_state: Cannot delete device type that is in use', 'not_found: Device type not found.']) {
      const refused = await call('UteamupIoTDeviceTypeDelete', args, errorReply(-32603, message));
      expect(refused.body.error.message).toBe(message);
    }
  });

  test('the type list has an explicit empty result', async () => {
    const reply = await call('UteamupIoTDeviceTypesList', {}, successReply([]));
    expect(JSON.parse(reply.body.result.content[0].text)).toEqual([]);
  });

  const tools = [
    { name: 'UteamupIoTDeviceTypeCreate', args: fields },
    { name: 'UteamupIoTDeviceTypeUpdate', args: { deviceTypeGuid: TYPE_GUID, ...fields } },
    { name: 'UteamupIoTDeviceTypeDelete', args: { deviceTypeGuid: TYPE_GUID } },
  ];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
