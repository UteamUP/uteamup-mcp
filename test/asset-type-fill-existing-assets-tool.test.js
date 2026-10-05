/**
 * UteamupAssetTypeFillExistingAssets MCP tool test.
 *
 * Writes one value for a newly added field on every existing asset of its type that has none
 * yet. Backend requires AssetType.Update + Asset.Update and refuses meter/capture fields.
 *
 * Generic-proxy pattern: nock-mocked backend /mcp POST, GUIDs only.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  sendRawRequest,
  successReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Asset type fill-existing-assets MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_asset_type_fill';
  const TOOL = 'UteamupAssetTypeFillExistingAssets';
  const ATTRIBUTE_GUID = 'd4444444-4444-4444-4444-444444444444';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const captureCall = async toolArgs => {
    let captured = null;
    nock(BASE_URL)
      .post('/mcp', body => {
        captured = body;
        return body.method === 'tools/call' && body.params?.name === TOOL;
      })
      .reply(200, JSON.stringify(successReply({}).body), { 'Content-Type': 'application/json' });
    await sendRawRequest(BASE_URL, TOOL, toolArgs);
    return captured;
  };

  const errorReply = message => ({
    status: 200,
    body: { jsonrpc: '2.0', error: { code: -32000, message }, id: 1 },
  });

  it('returns how many assets were filled', async () => {
    const response = await call(
      TOOL,
      { attributeGuid: ATTRIBUTE_GUID, rawValue: '12.5' },
      successReply({ filledAssetCount: 7 }),
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.filledAssetCount).toBe(7);
  });

  it('reports zero when every asset already has a value', async () => {
    const response = await call(
      TOOL,
      { attributeGuid: ATTRIBUTE_GUID, rawValue: 'true' },
      successReply({ filledAssetCount: 0 }),
    );
    expect(JSON.parse(response.body.result.content[0].text).filledAssetCount).toBe(0);
  });

  it('forwards the attribute GUID and raw value verbatim', async () => {
    const args = { attributeGuid: ATTRIBUTE_GUID, rawValue: '2026-10-05' };
    const captured = await captureCall(args);
    expect(captured.params.arguments).toEqual(args);
  });

  it('takes no userId / tenantId argument (identity comes from the Bearer token)', async () => {
    const captured = await captureCall({ attributeGuid: ATTRIBUTE_GUID, rawValue: 'x' });
    expect(captured.params.arguments.userId).toBeUndefined();
    expect(captured.params.arguments.tenantId).toBeUndefined();
    expect(captured.params.arguments.tenantGuid).toBeUndefined();
  });

  it.each([
    ['a meter field refusal', 'Only text, number, yes/no and date fields can be filled for existing assets. Meter fields take readings instead.'],
    ['an unparsable value', "Cannot parse 'abc' as Float."],
    ['a missing Asset.Update permission', 'Permission denied: Asset.Update required'],
    ['an attribute from another tenant', 'Attribute definition d4444444-4444-4444-4444-444444444444 not found'],
  ])('surfaces %s without crashing the proxy', async (_label, message) => {
    const response = await call(TOOL, { attributeGuid: ATTRIBUTE_GUID, rawValue: 'abc' }, errorReply(message));
    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toBe(message);
  });

  const allTools = [{ name: TOOL, args: { attributeGuid: ATTRIBUTE_GUID, rawValue: '1' } }];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
