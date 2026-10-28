'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('UteamupAssetRemoveDocument MCP tool', () => {
  const baseUrl = 'https://api.uteamup.com';
  const token = 'test_asset_document_detach';
  const name = 'UteamupAssetRemoveDocument';
  const args = {
    assetGuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    documentGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  };
  const call = (toolName, toolArgs, reply) => callMcpTool(baseUrl, token, toolName, toolArgs, reply, toolArgs);

  beforeAll(() => nock.disableNetConnect());
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  afterAll(() => nock.enableNetConnect());

  it('forwards the two public GUIDs without tenant or audit-user arguments', async () => {
    const response = await call(name, args, successReply(true));

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toBe(true);
    expect(nock.isDone()).toBe(true);
  });

  it('preserves not_found when no direct link exists instead of reporting a detach', async () => {
    const response = await call(name, args, {
      status: 200,
      body: {
        jsonrpc: '2.0', id: 1,
        result: {
          isError: true,
          content: [{ type: 'text', text: 'not_found: The direct document link was not found on this asset in the current tenant.' }],
        },
      },
    });

    expect(response.body.result.isError).toBe(true);
    expect(response.body.result.content[0].text).toContain('not_found:');
  });

  it('preserves the denial when the caller lacks Asset.Delete', async () => {
    const response = await call(name, args, errorReply(-32000, 'Permission denied: Asset.Delete required'));

    expect(response.body.error.message).toContain('Asset.Delete');
    expect(response.body.result).toBeUndefined();
  });

  const tools = [{ name, args }];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
