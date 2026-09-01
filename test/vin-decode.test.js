'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('VIN decode MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'vin-decode-token';
  const vin = '1HGCM82633A004352';
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('round-trips a decoded VIN without leaking integer ids', async () => {
    const response = await call(
      'UteamupFleetVinDecode',
      { vin },
      successReply({
        vin,
        make: 'HONDA',
        model: 'Accord',
        modelYear: '2003',
        bodyClass: 'Sedan',
        fuelTypePrimary: 'Gasoline',
        grossVehicleWeightRating: '3500',
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.vin).toBe(vin);
    expect(result.make).toBe('HONDA');
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('assetId');
  });

  test('preserves backend validation errors for malformed VINs', async () => {
    const response = await call(
      'UteamupFleetVinDecode',
      { vin: 'SHORT' },
      errorReply(-32602, 'Invalid VIN format. VIN must be 17 alphanumeric characters (no I, O, Q).'),
    );

    expect(response.body.error.code).toBe(-32602);
    expect(response.body.error.message).toContain('Invalid VIN format');
  });

  const tools = [{ name: 'UteamupFleetVinDecode', args: { vin } }];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
