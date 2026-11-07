'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Tenant sensor paging', () => {
  const BASE_URL = 'https://api.test.com'; // Mock transport only; live MCP always uses production.
  const guid = '55555555-5555-4555-8555-555555555555';
  const args = { search: 'temperature', page: 3, pageSize: 25, excludedGuids: [guid] };
  const call = (name, input, reply) => callMcpTool(BASE_URL, 'test-token', name, input, reply, input);
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('preserves search, exclusions and an empty page with the server total', async () => {
    const page = { items: [], totalItems: 50, page: 3, pageSize: 25, totalPages: 2, hasPrevious: true, hasNext: false };
    const reply = await call('UteamupIoTSensorsList', args, successReply(page));
    expect(JSON.parse(reply.body.result.content[0].text)).toEqual(page);
  });

  test('preserves a permission refusal without a false empty result', async () => {
    const reply = await call('UteamupIoTSensorsList', args, errorReply(-32603, 'permission_denied: IOT.View required'));
    expect(reply.body.error.message).toContain('permission_denied');
  });

  const tools = [{ name: 'UteamupIoTSensorsList', args }];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
