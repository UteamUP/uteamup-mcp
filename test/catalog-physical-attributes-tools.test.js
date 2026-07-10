/**
 * Catalog physical-attributes MCP tools test (stock-reseller-catalog section 14.3).
 *
 * Verifies the optional physical-attribute arguments now surfaced on the existing
 * catalog create/update tools forward verbatim through the generic proxy:
 *   - Part  create/update  → weightKg / lengthCm / widthCm / heightCm (decimal)
 *   - Tool  create/update  → weight / width / height / length (legacy float fields)
 *   - Chemical create/update → weightKg / lengthCm / widthCm / heightCm (decimal)
 *
 * Generic-proxy pattern: nock-mocked backend /mcp POST, GUIDs only, verbatim forwarding.
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

describe('Catalog physical-attributes MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_physical_attributes';

  const CHEMICAL_GUID = 'a1111111-1111-1111-1111-111111111111';

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

  describe('UteamupPartCreate physical attributes', () => {
    it('forwards weightKg and dimensions verbatim', async () => {
      const args = { name: 'Heavy Part', weightKg: 12.5, lengthCm: 30, widthCm: 20, heightCm: 10 };
      const captured = await captureCall('UteamupPartCreate', args);
      expect(captured.params.arguments).toEqual(args);
    });

    it('echoes the physical attributes back on the response', async () => {
      const response = await call(
        'UteamupPartCreate',
        { name: 'Heavy Part', weightKg: 12.5 },
        successReply({ id: 1, name: 'Heavy Part', weightKg: 12.5, lengthCm: null, widthCm: null, heightCm: null }),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.weightKg).toBe(12.5);
    });
  });

  describe('UteamupPartUpdate physical attributes', () => {
    it('forwards updated weightKg and dimensions verbatim', async () => {
      const args = { id: 7, weightKg: 9.9, lengthCm: 40, widthCm: 25, heightCm: 15 };
      const captured = await captureCall('UteamupPartUpdate', args);
      expect(captured.params.arguments).toEqual(args);
    });
  });

  describe('UteamupToolCreate physical attributes (legacy float fields)', () => {
    it('forwards weight/width/height/length verbatim', async () => {
      const args = { name: 'Heavy Tool', weight: 5.5, width: 12, height: 8, length: 20 };
      const captured = await captureCall('UteamupToolCreate', args);
      expect(captured.params.arguments).toEqual(args);
    });
  });

  describe('UteamupToolUpdate physical attributes (legacy float fields)', () => {
    it('forwards updated weight/width/height/length verbatim', async () => {
      const args = { id: 7, weight: 5.5, width: 12, height: 8, length: 20 };
      const captured = await captureCall('UteamupToolUpdate', args);
      expect(captured.params.arguments).toEqual(args);
    });
  });

  describe('UteamupChemicalCreate physical attributes (model passthrough)', () => {
    it('forwards the model with weightKg and dimensions verbatim', async () => {
      const args = {
        model: { name: 'Solvent', chemicalFormula: 'C2H6O', weightKg: 3.25, lengthCm: 40, widthCm: 25, heightCm: 15 },
      };
      const captured = await captureCall('UteamupChemicalCreate', args);
      expect(captured.params.arguments).toEqual(args);
      expect(captured.params.arguments.model.weightKg).toBe(3.25);
    });
  });

  describe('UteamupChemicalUpdate physical attributes (model passthrough)', () => {
    it('forwards the chemical GUID and model with dimensions verbatim', async () => {
      const args = {
        chemicalGuid: CHEMICAL_GUID,
        model: { name: 'Solvent', chemicalFormula: 'C2H6O', weightKg: 9.9, lengthCm: 50, widthCm: 30, heightCm: 20 },
      };
      const captured = await captureCall('UteamupChemicalUpdate', args);
      expect(captured.params.arguments).toEqual(args);
    });
  });

  const allTools = [
    { name: 'UteamupPartCreate', args: { name: 'Heavy Part', weightKg: 12.5 } },
    { name: 'UteamupPartUpdate', args: { id: 7, weightKg: 9.9 } },
    { name: 'UteamupToolCreate', args: { name: 'Heavy Tool', weight: 5.5 } },
    { name: 'UteamupToolUpdate', args: { id: 7, weight: 5.5 } },
    { name: 'UteamupChemicalCreate', args: { model: { name: 'Solvent', chemicalFormula: 'C2H6O', weightKg: 3.25 } } },
    { name: 'UteamupChemicalUpdate', args: { chemicalGuid: CHEMICAL_GUID, model: { name: 'Solvent', chemicalFormula: 'C2H6O' } } },
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
