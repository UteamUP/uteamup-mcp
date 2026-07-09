/** Generic-proxy contract for the backend-registered UteamupAssetAsk tool. */
'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('UteamupAssetAsk MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_asset_assistant';
  const args = {
    assetGuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    question: 'What failed most recently?',
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const callTool = (name, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, name, toolArgs, mockReply);
  const call = mockReply => callTool('UteamupAssetAsk', args, mockReply);

  it('round-trips a source-backed answer and GUID citations', async () => {
    const response = await call(successReply({
      assetGuid: args.assetGuid,
      answer: 'The mechanical seal failed. [S1]',
      citations: [{
        sourceId: 'S1',
        sourceType: 'Workorder',
        sourceGuid: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        title: 'Replace mechanical seal',
        route: '/workorders/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        excerpt: 'Leak found at the mechanical seal.',
      }],
      creditsCharged: 2,
      remaining: 18,
    }));

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.answer).toContain('[S1]');
    expect(data.citations[0].sourceGuid).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    expect(data.creditsCharged).toBe(2);
  });

  it('surfaces permission failures as JSON-RPC errors', async () => {
    const response = await call(errorReply(-32000, 'Permission denied: Asset.View required'));
    expect(response.body.error.message).toMatch(/Asset\.View/);
  });

  const tools = [{ name: 'UteamupAssetAsk', args }];
  describeJsonRpcCompliance(callTool, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
