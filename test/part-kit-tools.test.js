/**
 * Part kit MCP tools test (stock-reseller-catalog section 10).
 *
 * Four tools over kit definitions: UteamupPartListKitComponents,
 * UteamupPartAddKitComponent, UteamupPartDeleteKitComponent, UteamupPartGetKitAvailability.
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

describe('Part kit MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_part_kit';

  const PART_GUID = 'a1111111-1111-1111-1111-111111111111';
  const COMPONENT_PART_GUID = 'b2222222-2222-2222-2222-222222222222';
  const COMPONENT_GUID = 'c3333333-3333-3333-3333-333333333333';

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

  describe('UteamupPartListKitComponents', () => {
    it('returns the component lines with per-kit quantities', async () => {
      const response = await call(
        'UteamupPartListKitComponents',
        { partGuid: PART_GUID },
        successReply([
          { guid: COMPONENT_GUID, parentPartGuid: PART_GUID, componentPartGuid: COMPONENT_PART_GUID, componentPartName: 'Brake pad', quantity: 2 },
        ]),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].quantity).toBe(2);
      expect(data[0].componentPartName).toBe('Brake pad');
    });

    it('forwards the kit part GUID verbatim', async () => {
      const captured = await captureCall('UteamupPartListKitComponents', { partGuid: PART_GUID });
      expect(captured.params.arguments).toEqual({ partGuid: PART_GUID });
    });
  });

  describe('UteamupPartAddKitComponent', () => {
    it('forwards the component GUID and quantity verbatim', async () => {
      const args = { partGuid: PART_GUID, componentPartGuid: COMPONENT_PART_GUID, quantity: 3 };
      const captured = await captureCall('UteamupPartAddKitComponent', args);
      expect(captured.params.arguments).toEqual(args);
    });

    it('surfaces a cycle-guard conflict without crashing the proxy', async () => {
      const response = await call(
        'UteamupPartAddKitComponent',
        { partGuid: PART_GUID, componentPartGuid: COMPONENT_PART_GUID, quantity: 1 },
        {
          status: 200,
          body: { jsonrpc: '2.0', error: { code: -32000, message: 'Adding this component would create a kit cycle' }, id: 1 },
        },
      );
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('cycle');
    });
  });

  describe('UteamupPartDeleteKitComponent', () => {
    it('forwards both GUIDs verbatim', async () => {
      const captured = await captureCall('UteamupPartDeleteKitComponent', { partGuid: PART_GUID, componentGuid: COMPONENT_GUID });
      expect(captured.params.arguments).toEqual({ partGuid: PART_GUID, componentGuid: COMPONENT_GUID });
    });
  });

  describe('UteamupPartGetKitAvailability', () => {
    it('returns the buildable kit count and per-component breakdown', async () => {
      const response = await call(
        'UteamupPartGetKitAvailability',
        { partGuid: PART_GUID },
        successReply({
          partGuid: PART_GUID,
          buildableKits: 4,
          components: [
            { componentPartGuid: COMPONENT_PART_GUID, componentPartName: 'Brake pad', quantityPerKit: 2, availableToPromise: 10, buildableKits: 5 },
          ],
        }),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.buildableKits).toBe(4);
      expect(data.components[0].availableToPromise).toBe(10);
    });
  });

  describe('identity comes from the Bearer token (spoofing guard)', () => {
    it.each([
      ['UteamupPartListKitComponents', { partGuid: PART_GUID }],
      ['UteamupPartAddKitComponent', { partGuid: PART_GUID, componentPartGuid: COMPONENT_PART_GUID, quantity: 1 }],
      ['UteamupPartGetKitAvailability', { partGuid: PART_GUID }],
    ])('%s takes no userId / tenantId argument', async (name, args) => {
      const captured = await captureCall(name, args);
      expect(captured.params.arguments.userId).toBeUndefined();
      expect(captured.params.arguments.tenantId).toBeUndefined();
      expect(captured.params.arguments.tenantGuid).toBeUndefined();
    });
  });

  const allTools = [
    { name: 'UteamupPartListKitComponents', args: { partGuid: PART_GUID } },
    { name: 'UteamupPartAddKitComponent', args: { partGuid: PART_GUID, componentPartGuid: COMPONENT_PART_GUID, quantity: 1 } },
    { name: 'UteamupPartDeleteKitComponent', args: { partGuid: PART_GUID, componentGuid: COMPONENT_GUID } },
    { name: 'UteamupPartGetKitAvailability', args: { partGuid: PART_GUID } },
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
