'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

// Transport contract sources, not execution of backend authorization or the server dispatcher.
describe('GUID-enrolled client device tools', () => {
  const baseUrl = 'https://api.test.com';
  const token = 'device_contract_token';
  const deviceGuid = '11111111-1111-4111-8111-111111111111';
  const metadata = {
    deviceGuid,
    actorGuid: '22222222-2222-4222-8222-222222222222',
    tenantGuid: '33333333-3333-4333-8333-333333333333',
    environment: 'https://api.test.com',
    enrollmentVersion: 8,
    enrollmentPolicyVersion: 2,
    isActive: false,
    revokedAt: '2026-10-04T01:02:03Z',
    registeredAt: '2026-10-03T01:02:03Z',
    lastEnrollmentActivityAt: '2026-10-03T01:02:03Z',
    capabilitiesVerified: false,
    offlineAuthorized: false,
  };
  const tools = [
    { name: 'UteamupClientDeviceMine', args: { page: 1, pageSize: 50 } },
    { name: 'UteamupClientDeviceList', args: { page: 2, pageSize: 3 } },
    { name: 'UteamupClientDeviceGet', args: { deviceGuid } },
    { name: 'UteamupClientDeviceRevoke', args: { deviceGuid, body: { expectedEnrollmentVersion: 7 } } },
  ];
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  const call = (name, args, reply) => callMcpTool(baseUrl, token, name, args, reply, args);

  test.each(tools)('$name preserves exact scoped arguments and false authority flags', async ({ name, args }) => {
    const totalItems = name.endsWith('Mine') ? 1 : 4;
    const expected = name.endsWith('Mine') || name.endsWith('List')
      ? { items: [metadata], currentPage: args.page, pageSize: args.pageSize, totalItems, totalPages: Math.ceil(totalItems / args.pageSize) }
      : metadata;
    const response = await call(name, args, successReply(expected));
    expect(response.status).toBe(200);
    const actual = JSON.parse(response.body.result.content[0].text);
    expect(actual).toEqual(expected);
    const returnedMetadata = Array.isArray(actual.items) ? actual.items[0] : actual;
    expect(Object.keys(returnedMetadata)).toHaveLength(12);
    expect(returnedMetadata.capabilitiesVerified).toBe(false);
    expect(returnedMetadata.offlineAuthorized).toBe(false);
    for (const property of ['actorGuid', 'tenantGuid', 'userId', 'deviceId', 'canManageAny']) {
      expect(args).not.toHaveProperty(property);
    }
  });

  test.each(tools)('$name preserves denied authorization without returning metadata', async ({ name, args }) => {
    const message = 'Current tenant device authority is required.';
    const denied = await call(name, args, errorReply(-32000, message));
    expect(denied.body.error).toEqual({ code: -32000, message });
    expect(denied.body.result).toBeUndefined();
    expect(JSON.stringify(denied.body)).not.toContain('deviceGuid');
    const httpDenied = await call(name, args, { status: 403, body: { message } });
    expect(httpDenied.status).toBe(403);
    expect(httpDenied.body).toEqual({ message });
    expect(httpDenied.body.result).toBeUndefined();
  });

  test('empty page is retained and conflict remains a JSON-RPC error', async () => {
    const page = { items: [], currentPage: 2, pageSize: 50, totalItems: 0, totalPages: 0 };
    const response = await call('UteamupClientDeviceMine', {}, successReply(page));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(page);
    const conflict = await call('UteamupClientDeviceRevoke', tools[3].args,
      errorReply(-32000, 'Enrollment changed. Read the current enrollment version.'));
    expect(conflict.body.error.message).toContain('Enrollment changed');
    expect(conflict.body.result).toBeUndefined();
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
