'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

const baseUrl = 'https://api.test.com';
const connectorGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tools = [
  { name: 'UteamupEdgeConnectorsList', args: {} },
  { name: 'UteamupEdgeConnectorRadioGet', args: { connectorGuid } },
];
const call = (name, args, reply) => callMcpTool(baseUrl, 'synthetic-token', name, args, reply);

describe('Read-only connector administration', () => {
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  test.each(tools)('$name preserves the response without identity overrides', async ({ name, args }) => {
    const data = { connectorGuid, desiredState: 'Suspended', observedState: 'Active', changePending: true };
    const response = await call(name, args, successReply(data));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(data);
    expect(Object.keys(args)).not.toContain('tenantGuid');
    expect(Object.keys(args)).not.toContain('userGuid');
  });
  test('an empty tenant registry remains empty', async () => {
    const response = await call(tools[0].name, {}, successReply([]));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });
  test('a permission denial does not become a module status', async () => {
    const response = await call(tools[1].name, { connectorGuid }, errorReply(-32603, 'EDGE_CONNECTOR_ACCESS_DENIED'));
    expect(response.body.error.message).toBe('EDGE_CONNECTOR_ACCESS_DENIED');
  });
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
