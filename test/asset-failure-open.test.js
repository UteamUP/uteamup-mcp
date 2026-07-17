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

  test('round-trips severity-filtered failure GUID evidence', async () => {
    const response = await call(
      'UteamupAssetfailureGetBySeverity',
      { severity: 'Critical' },
      successReply([{
        externalGuid: '22222222-2222-2222-2222-222222222222',
        assetGuid: '33333333-3333-3333-3333-333333333333',
        severity: 'Critical',
      }]),
    );

    const [failure] = JSON.parse(response.body.result.content[0].text);
    expect(failure.externalGuid).toBe('22222222-2222-2222-2222-222222222222');
    expect(failure.severity).toBe('Critical');
  });

  test('uses GUID-only identity arguments for failure and asset reads', async () => {
    const failureGuid = '44444444-4444-4444-8444-444444444444';
    const assetGuid = '55555555-5555-4555-8555-555555555555';
    const cases = [
      ['UteamupAssetfailureGet', { failureGuid }],
      ['UteamupAssetfailureGetByAsset', { assetGuid }],
      ['UteamupAssetfailureGetStatistics', { assetGuid }],
    ];

    for (const [toolName, args] of cases) {
      const response = await call(toolName, args, successReply({ ok: true }));
      expect(response.status).toBe(200);
      expect(JSON.stringify(args)).not.toMatch(/"(?:id|assetId|failureId)"/);
    }
  });

  const tools = [
    { name: 'UteamupAssetfailureGetOpen', args: {} },
    { name: 'UteamupAssetfailureGetBySeverity', args: { severity: 'Critical' } },
    { name: 'UteamupAssetfailureGet', args: { failureGuid: '44444444-4444-4444-8444-444444444444' } },
    { name: 'UteamupAssetfailureGetByAsset', args: { assetGuid: '55555555-5555-4555-8555-555555555555' } },
    { name: 'UteamupAssetfailureGetStatistics', args: { assetGuid: '55555555-5555-4555-8555-555555555555' } },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
