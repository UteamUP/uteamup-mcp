'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

// Proxy transport coverage only; backend authority is covered by backend tests.
describe('Vendor rating enrolled-device protocol', () => {
  const baseUrl = 'https://api.test.com';
  const token = 'vendor_rating_contract_token';
  const originalJson = ' \n{"operationGuid":"11111111-1111-4111-8111-111111111111"}\n ';
  const model = { schemaVersion: 1, originalJson, deviceGuid: '22222222-2222-4222-8222-222222222222', enrollmentVersion: 7, deviceKeyThumbprint: 'thumbprint' };
  const tools = [
    { name: 'UteamupVendorRatingDeviceProof', args: { operationAction: 'create', model } },
    { name: 'UteamupVendorRatingDeviceRegister', args: { operationAction: 'update', model: { ...model, signature: 'signed-original' } } },
    { name: 'UteamupVendorRatingDeviceDeliver', args: { operationAction: 'delete', model: { ...model, signature: 'signed-original' }, confirmed: true } },
    { name: 'UteamupVendorRatingDeviceDeliver', args: { operationAction: 'flag', model: { ...model, signature: 'signed-original' }, confirmed: true } },
    { name: 'UteamupVendorRatingDeviceDeliver', args: { operationAction: 'moderate', model: { ...model, signature: 'signed-original' }, confirmed: true } },
  ];
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  const call = (name, args, reply) => callMcpTool(baseUrl, token, name, args, reply, args);

  test.each(tools)('$name preserves exact originals and scoped DTOs', async ({ name, args }) => {
    const expected = { schemaVersion: 1 };
    const response = await call(name, args, successReply(expected));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(expected);
    expect(args.model.originalJson).toBe(originalJson);
    for (const field of ['tenantGuid', 'actorGuid', 'privateKey', 'userId']) {
      expect(args).not.toHaveProperty(field);
      expect(args.model).not.toHaveProperty(field);
    }
  });

  test.each(tools)('$name retains denial without exposing original work', async ({ name, args }) => {
    const response = await call(name, args, errorReply(-32000, 'Current Vendor rating authority is required.'));
    expect(response.body.result).toBeUndefined();
    expect(response.body.error.code).toBe(-32000);
    expect(JSON.stringify(response.body)).not.toContain('originalJson');
  });

  test.each(tools)('$name does not invent an acknowledgment for null', async ({ name, args }) => {
    const response = await call(name, args, successReply(null));
    expect(JSON.parse(response.body.result.content[0].text)).toBeNull();
  });

  test('unconfirmed delivery remains denied by the backend', async () => {
    const args = { ...tools[2].args, confirmed: false };
    const response = await call(tools[2].name, args, errorReply(-32602, 'Explicit Vendor rating delivery confirmation required.'));
    expect(response.body.result).toBeUndefined();
    expect(response.body.error.code).toBe(-32602);
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
