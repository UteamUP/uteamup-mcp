'use strict';
const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');
const BASE_URL = 'https://api.uteamup.com';
const tool = 'UteamupTenantMemberAccessSet';
const args = { userGuid: '31000000-0000-4000-8000-000000000002', body: { accessAllowed: false } };
const call = (name, body, reply) => callMcpTool(BASE_URL, 'test_access_token_membership', name, body, reply, body);

describe('tenant member access transport', () => {
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  test('preserves the explicit false choice and server-confirmed result', async () => {
    const result = { userGuid: args.userGuid, accessAllowed: false, accessEndsAt: '2026-11-10T12:00:00Z' };
    const response = await call(tool, args, successReply(result));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(result);
  });
  test('preserves a missing member response', async () => {
    const response = await call(tool, args, successReply(null));
    expect(JSON.parse(response.body.result.content[0].text)).toBeNull();
  });
  test('preserves a protected-member refusal', async () => {
    const response = await call(tool, args, errorReply(-32000, 'Protected membership'));
    expect(response.body.error.message).toContain('Protected membership');
  });
  describeJsonRpcCompliance(call, [{ name: tool, args }]);
  describe401Unauthorized(BASE_URL, [{ name: tool, args }]);
  describe503ServiceUnavailable(BASE_URL, [{ name: tool, args }]);
});
