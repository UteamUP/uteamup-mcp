'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Open asset failure MCP read', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'asset-failure-open-token';
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('round-trips tenant open-failure evidence without identifier arguments', async () => {
    const response = await call(
      'UteamupAssetfailureGetOpen',
      {},
      successReply([{
        assetGuid: '11111111-1111-1111-1111-111111111111',
        assetName: 'Cooling pump 2',
        failureDate: '2026-07-17T00:00:00Z',
        status: 'Open',
        severity: 'High',
        failureDescription: 'Bearing temperature exceeded the alarm limit.',
      }]),
    );

    const [failure] = JSON.parse(response.body.result.content[0].text);
    expect(failure.assetGuid).toBe('11111111-1111-1111-1111-111111111111');
    expect(failure.status).toBe('Open');
  });

  const tools = [{ name: 'UteamupAssetfailureGetOpen', args: {} }];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
