/**
 * Part fitment / compatibility MCP tools test (stock-reseller-catalog section 12).
 *
 * Four tools: UteamupPartListCompatibility, UteamupPartAddCompatibility,
 * UteamupPartDeleteCompatibility (part-scoped) and UteamupAssetTypeListCompatibleParts
 * (the reverse lookup, by asset type).
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

describe('Part fitment / compatibility MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_part_fitment';

  const PART_GUID = 'a1111111-1111-1111-1111-111111111111';
  const ASSET_TYPE_GUID = 'b2222222-2222-2222-2222-222222222222';
  const COMPAT_GUID = 'c3333333-3333-3333-3333-333333333333';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const captureCall = async (toolName, toolArgs) => {
    let captured = null;
    nock(BASE_URL)
      .post('/mcp', body => {
        captured = body;
        return body.method === 'tools/call' && body.params?.name === toolName;
      })
      .reply(200, JSON.stringify(successReply({}).body), { 'Content-Type': 'application/json' });
    await sendRawRequest(BASE_URL, toolName, toolArgs);
    return captured;
  };

  describe('UteamupPartListCompatibility', () => {
    it('returns the asset types a part fits', async () => {
      const response = await call(
        'UteamupPartListCompatibility',
        { partGuid: PART_GUID },
        successReply([
          { guid: COMPAT_GUID, partGuid: PART_GUID, assetTypeGuid: ASSET_TYPE_GUID, assetTypeName: 'Centrifugal Pump', notes: 'MK2 only' },
        ]),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].assetTypeName).toBe('Centrifugal Pump');
    });

    it('forwards the part GUID verbatim', async () => {
      const captured = await captureCall('UteamupPartListCompatibility', { partGuid: PART_GUID });
      expect(captured.params.arguments).toEqual({ partGuid: PART_GUID });
    });
  });

  describe('UteamupPartAddCompatibility', () => {
    it('forwards the asset-type GUID and notes verbatim', async () => {
      const args = { partGuid: PART_GUID, assetTypeGuid: ASSET_TYPE_GUID, notes: 'MK2 only' };
      const captured = await captureCall('UteamupPartAddCompatibility', args);
      expect(captured.params.arguments).toEqual(args);
    });

    it('surfaces a duplicate-fitment conflict without crashing the proxy', async () => {
      const response = await call(
        'UteamupPartAddCompatibility',
        { partGuid: PART_GUID, assetTypeGuid: ASSET_TYPE_GUID },
        {
          status: 200,
          body: { jsonrpc: '2.0', error: { code: -32000, message: 'This part is already declared compatible with that asset type' }, id: 1 },
        },
      );
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('already declared');
    });
  });

  describe('UteamupPartDeleteCompatibility', () => {
    it('forwards both GUIDs verbatim', async () => {
      const captured = await captureCall('UteamupPartDeleteCompatibility', { partGuid: PART_GUID, compatibilityGuid: COMPAT_GUID });
      expect(captured.params.arguments).toEqual({ partGuid: PART_GUID, compatibilityGuid: COMPAT_GUID });
    });
  });

  describe('UteamupAssetTypeListCompatibleParts', () => {
    it('returns the parts that fit an asset type (reverse lookup)', async () => {
      const response = await call(
        'UteamupAssetTypeListCompatibleParts',
        { assetTypeGuid: ASSET_TYPE_GUID },
        successReply([
          { guid: COMPAT_GUID, partGuid: PART_GUID, partName: 'Mechanical seal', assetTypeGuid: ASSET_TYPE_GUID, assetTypeName: 'Centrifugal Pump' },
        ]),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].partName).toBe('Mechanical seal');
    });

    it('forwards the asset-type GUID verbatim', async () => {
      const captured = await captureCall('UteamupAssetTypeListCompatibleParts', { assetTypeGuid: ASSET_TYPE_GUID });
      expect(captured.params.arguments).toEqual({ assetTypeGuid: ASSET_TYPE_GUID });
    });
  });

  describe('identity comes from the Bearer token (spoofing guard)', () => {
    it.each([
      ['UteamupPartListCompatibility', { partGuid: PART_GUID }],
      ['UteamupAssetTypeListCompatibleParts', { assetTypeGuid: ASSET_TYPE_GUID }],
    ])('%s takes no userId / tenantId argument', async (name, args) => {
      const captured = await captureCall(name, args);
      expect(captured.params.arguments.userId).toBeUndefined();
      expect(captured.params.arguments.tenantId).toBeUndefined();
      expect(captured.params.arguments.tenantGuid).toBeUndefined();
    });
  });

  const allTools = [
    { name: 'UteamupPartListCompatibility', args: { partGuid: PART_GUID } },
    { name: 'UteamupPartAddCompatibility', args: { partGuid: PART_GUID, assetTypeGuid: ASSET_TYPE_GUID } },
    { name: 'UteamupPartDeleteCompatibility', args: { partGuid: PART_GUID, compatibilityGuid: COMPAT_GUID } },
    { name: 'UteamupAssetTypeListCompatibleParts', args: { assetTypeGuid: ASSET_TYPE_GUID } },
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
