'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');
const BASE_URL = 'https://api.test.com';
const name = 'UteamupOncallCoverageWorkers';
const args = { requestGuid: '11111111-1111-4111-8111-111111111111', search: 'Alex & Robin', page: 2, pageSize: 25 };
const call = (tool, input, reply) => callMcpTool(BASE_URL, 'coverage_token', tool, input, reply, input);

describe('On-call coverage worker lookup', () => {
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  test.each([
    { items: [{ guid: '22222222-2222-4222-8222-222222222222', name: 'Alex Worker' }], totalItems: 26, page: 2, pageSize: 25 },
    { items: [], totalItems: 0, page: 1, pageSize: 25 },
    null,
  ])('preserves minimal choices and empty or unavailable requests: %j', async result => {
    const response = await call(name, args, successReply(result));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(result);
    expect(nock.isDone()).toBe(true);
    expect(args).not.toHaveProperty('tenantGuid');
    expect(args).not.toHaveProperty('userId');
  });
  test('preserves a changed-request error', async () => {
    const response = await call(name, args, errorReply(-32000, 'Request is no longer pending'));
    expect(response.body.error.message).toContain('no longer pending');
  });
  describeJsonRpcCompliance(call, [{ name, args }]);
  describe401Unauthorized(BASE_URL, [{ name, args }]);
  describe503ServiceUnavailable(BASE_URL, [{ name, args }]);
});
