'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Distance-tax MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'distance-tax-token';
  const assetGuid = '3e1cd135-07d1-46ff-8f5f-549da5390e78';
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('lists schemes as global data rows keyed by country', async () => {
    const response = await call(
      'UteamupDistanceTaxSchemes',
      {},
      successReply([
        {
          externalGuid: '0b6a2e2f-3f9f-4d8e-9a3a-1c2d3e4f5a6b',
          key: 'is.kilometragjald',
          countryCode: 'IS',
          displayName: 'Kílómetragjald (Act 100/2025)',
          currencyCode: 'ISK',
          rateTableJson: '[{"effectiveFrom":"2026-01-01","bands":[{"maxWeightKg":3500,"ratePerKm":6.95}]}]',
          isSystemScheme: true,
        },
      ]),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result[0].key).toBe('is.kilometragjald');
    expect(result[0].countryCode).toBe('IS');
    expect(result[0]).not.toHaveProperty('id');
  });

  test('report round-trips the hand-computed kilometragjald math', async () => {
    const response = await call(
      'UteamupDistanceTaxReport',
      { schemeKey: 'is.kilometragjald', from: '2026-01-01T00:00:00Z', to: '2026-06-30T00:00:00Z' },
      successReply({
        schemeKey: 'is.kilometragjald',
        currencyCode: 'ISK',
        rows: [
          {
            assetGuid,
            assetName: 'Rental Car RX-747',
            periodKm: 2500,
            ratePerKm: 6.95,
            amount: 17375,
          },
        ],
        totalKm: 2500,
        totalAmount: 17375,
        submissionStatus: 'BlockedOnOfficialApi',
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.totalAmount).toBe(17375);
    expect(result.submissionStatus).toBe('BlockedOnOfficialApi');
    expect(result.rows[0].assetGuid).toBe(assetGuid);
    expect(result.rows[0]).not.toHaveProperty('assetId');
  });

  test('fuel-based schemes are rejected with the IFTA pointer', async () => {
    const response = await call(
      'UteamupDistanceTaxReport',
      { schemeKey: 'us.ifta', from: '2026-01-01T00:00:00Z', to: '2026-03-31T00:00:00Z' },
      errorReply(-32602, "Scheme 'us.ifta' has no per-kilometre rate bands — it is not a km-band scheme. The US IFTA scheme is fuel-based and reported at api/fleet/ifta/report."),
    );

    expect(response.body.error.code).toBe(-32602);
    expect(response.body.error.message).toContain('api/fleet/ifta/report');
  });

  test('statutory due list carries guid identities and overdue flags', async () => {
    const response = await call(
      'UteamupDistanceTaxStatutoryDue',
      {},
      successReply([
        {
          assetGuid,
          assetName: 'Rental Car RX-747',
          registrationNumber: 'RX-747',
          lastStatutoryReadingAt: '2026-01-05T00:00:00Z',
          dueAt: '2026-07-06T00:00:00Z',
          isOverdue: true,
        },
      ]),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result[0].isOverdue).toBe(true);
    expect(result[0].assetGuid).toBe(assetGuid);
    expect(result[0]).not.toHaveProperty('assetId');
  });

  const tools = [
    { name: 'UteamupDistanceTaxSchemes', args: {} },
    {
      name: 'UteamupDistanceTaxReport',
      args: { schemeKey: 'is.kilometragjald', from: '2026-01-01T00:00:00Z', to: '2026-06-30T00:00:00Z' },
    },
    { name: 'UteamupDistanceTaxStatutoryDue', args: {} },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
