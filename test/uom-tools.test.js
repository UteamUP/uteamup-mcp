/**
 * Units-of-measure MCP tools test (stock-reseller-catalog pack-conversion section 8).
 *
 * Three tools: UteamupUomList, UteamupUomCreate, UteamupUomDelete.
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

describe('Units-of-measure MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_uom';

  const UOM_GUID = 'a1111111-1111-1111-1111-111111111111';

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

  describe('UteamupUomList', () => {
    it('returns the shared set plus tenant units, flagging system rows', async () => {
      const response = await call(
        'UteamupUomList',
        {},
        successReply([
          { guid: UOM_GUID, code: 'box', name: 'Box', category: 'Count', isSystem: true },
          { guid: 'b2222222-2222-2222-2222-222222222222', code: 'pallet', name: 'Pallet', category: 'Count', isSystem: false },
        ]),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(2);
      expect(data[0].isSystem).toBe(true);
      expect(data[1].code).toBe('pallet');
    });

    it('takes no arguments (tenant comes from the Bearer token)', async () => {
      const captured = await captureCall('UteamupUomList', {});
      expect(captured.params.arguments).toEqual({});
    });
  });

  describe('UteamupUomCreate', () => {
    it('forwards code, name, and category verbatim', async () => {
      const args = { code: 'pallet', name: 'Pallet', category: 'Count' };
      const captured = await captureCall('UteamupUomCreate', args);
      expect(captured.params.arguments).toEqual(args);
    });

    it('returns the created unit', async () => {
      const response = await call(
        'UteamupUomCreate',
        { code: 'pallet', name: 'Pallet' },
        successReply({ guid: UOM_GUID, code: 'pallet', name: 'Pallet', isSystem: false }),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.code).toBe('pallet');
      expect(data.isSystem).toBe(false);
    });

    it('surfaces a duplicate-code conflict without crashing the proxy', async () => {
      const response = await call(
        'UteamupUomCreate',
        { code: 'box', name: 'Box' },
        {
          status: 200,
          body: { jsonrpc: '2.0', error: { code: -32000, message: 'A unit with code box already exists' }, id: 1 },
        },
      );
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('already exists');
    });
  });

  describe('UteamupUomDelete', () => {
    it('forwards the uom GUID verbatim', async () => {
      const captured = await captureCall('UteamupUomDelete', { uomGuid: UOM_GUID });
      expect(captured.params.arguments).toEqual({ uomGuid: UOM_GUID });
    });

    it('returns false for a non-deletable system unit', async () => {
      const response = await call('UteamupUomDelete', { uomGuid: UOM_GUID }, successReply(false));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toBe(false);
    });
  });

  const allTools = [
    { name: 'UteamupUomList', args: {} },
    { name: 'UteamupUomCreate', args: { code: 'pallet', name: 'Pallet' } },
    { name: 'UteamupUomDelete', args: { uomGuid: UOM_GUID } },
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
