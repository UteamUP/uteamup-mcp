'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Available asset rental MCP read', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'asset-rental-available-token';
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('round-trips rental and asset GUID evidence', async () => {
    const response = await call(
      'UteamupAssetrentalGetAvailable',
      {},
      successReply([{
        externalGuid: '11111111-1111-1111-1111-111111111111',
        assetGuid: '22222222-2222-2222-2222-222222222222',
        assetName: 'Portable generator G-4',
        isAvailable: true,
      }]),
    );

    const [rental] = JSON.parse(response.body.result.content[0].text);
    expect(rental.externalGuid).toBe('11111111-1111-1111-1111-111111111111');
    expect(rental.assetGuid).toBe('22222222-2222-2222-2222-222222222222');
    expect(rental.isAvailable).toBe(true);
  });

  test('round-trips active rental return evidence', async () => {
    const response = await call(
      'UteamupAssetrentalGetRented',
      {},
      successReply([{
        externalGuid: '33333333-3333-3333-3333-333333333333',
        assetGuid: '44444444-4444-4444-4444-444444444444',
        currentRentalExpectedEndDate: '2026-07-27T00:00:00Z',
      }]),
    );

    const [rental] = JSON.parse(response.body.result.content[0].text);
    expect(rental.externalGuid).toBe('33333333-3333-3333-3333-333333333333');
    expect(rental.currentRentalExpectedEndDate).toBe('2026-07-27T00:00:00Z');
  });

  const tools = [
    { name: 'UteamupAssetrentalGetAvailable', args: {} },
    { name: 'UteamupAssetrentalGetRented', args: {} },
    { name: 'UteamupAssetrentalGetExpiringSoon', args: { days: 30 } },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
