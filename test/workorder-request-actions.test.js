'use strict';
const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Requester workorder actions', () => {
  const baseUrl = 'https://api.uteamup.com';
  const args = { workorderGuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
  const tools = [
    { name: 'UteamupWorkorderWithdrawRequest', args },
    { name: 'UteamupWorkorderRequestClosure', args },
  ];
  const call = (name, toolArgs, reply) => callMcpTool(baseUrl, 'requester-test-token', name, toolArgs, reply, toolArgs);
  beforeAll(() => nock.disableNetConnect());
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  afterAll(() => nock.enableNetConnect());

  it.each(tools)('$name forwards only the request GUID and preserves its status', async ({ name }) => {
    const status = name.endsWith('WithdrawRequest') ? 5 : 2;
    const response = await call(name, args, successReply({ guid: args.workorderGuid, status }));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual({ guid: args.workorderGuid, status });
    expect(nock.isDone()).toBe(true);
  });
  it.each(tools)('$name preserves requester and permission denials', async ({ name }) => {
    const response = await call(name, args, errorReply(-32000, 'Sign in as the requester to manage your own request.'));
    expect(response.body.error.message).toContain('requester');
    expect(response.body.result).toBeUndefined();
  });
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
