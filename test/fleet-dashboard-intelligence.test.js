'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Fleet dashboard intelligence MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'fleet-dashboard-token';
  const assetGuid = '11111111-1111-1111-1111-111111111111';
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('round-trips GUID-first fleet utilization', async () => {
    const response = await call(
      'UteamupFleetDashboardGetUtilization',
      {},
      successReply([{
        assetGuid,
        assetName: 'Vehicle 1',
        utilizationRate: 75,
        daysInService: 15,
        totalDays: 20,
      }]),
    );

    const [item] = JSON.parse(response.body.result.content[0].text);
    expect(item.assetGuid).toBe(assetGuid);
    expect(item.utilizationRate).toBe(75);
    expect(item).not.toHaveProperty('assetId');
    expect(item).not.toHaveProperty('id');
  });

  test('round-trips GUID-first fleet compliance', async () => {
    const response = await call(
      'UteamupFleetDashboardGetCompliance',
      {},
      successReply([{
        assetGuid,
        assetName: 'Vehicle 1',
        complianceType: 'Daily Pre-Trip / DVIR',
        dueDate: '2026-07-17T00:00:00Z',
        status: 'Overdue',
      }]),
    );

    const [item] = JSON.parse(response.body.result.content[0].text);
    expect(item.assetGuid).toBe(assetGuid);
    expect(item.status).toBe('Overdue');
    expect(item).not.toHaveProperty('assetId');
  });

  test('preserves backend validation errors', async () => {
    const response = await call(
      'UteamupFleetDashboardGetCompliance',
      {},
      errorReply(-32603, 'Fleet compliance is unavailable'),
    );

    expect(response.body.error.code).toBe(-32603);
    expect(response.body.error.message).toContain('unavailable');
  });

  test('round-trips comparable fuel and idling anomaly evidence', async () => {
    const response = await call(
      'UteamupFleetIntelligenceGetAnomalies',
      { lookbackDays: 60, minimumHistory: 8 },
      successReply({
        readiness: {
          eligible: true,
          validRecords: 10,
          excludedRecords: 2,
        },
        anomalies: [{
          sourceGuid: '22222222-2222-4222-8222-222222222222',
          assetGuid,
          anomalyType: 'FuelConsumption',
          sourceQuality: 'Recorded',
          confidence: 0.88,
        }],
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.readiness.eligible).toBe(true);
    expect(result.anomalies[0].assetGuid).toBe(assetGuid);
    expect(result.anomalies[0]).not.toHaveProperty('assetId');
  });

  test('round-trips tire readiness by public asset GUID', async () => {
    const response = await call(
      'UteamupFleetIntelligenceGetTireReadiness',
      { assetGuid },
      successReply({
        assetGuid,
        safetyStatus: 'Withheld',
        eligible: false,
        withheldReason: 'Pressure evidence is stale',
        measurements: [],
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.assetGuid).toBe(assetGuid);
    expect(result.eligible).toBe(false);
    expect(result.withheldReason).toContain('stale');
  });

  test('round-trips replacement TCO with explicit single-currency assumptions', async () => {
    const args = {
      assetGuid,
      currency: 'EUR',
      horizonMonths: 36,
      replacementEstimate: 42000,
      residualValue: 8000,
      financingCost: 1800,
      downtimeCostPerHour: 125,
      replacementAnnualMaintenanceCost: 900,
      replacementFuelReductionPercent: 12,
    };
    const response = await call(
      'UteamupFleetIntelligenceGetReplacementTco',
      args,
      successReply({
        assetGuid,
        currency: 'EUR',
        eligible: true,
        netReplacementBenefit: 6000,
        assumptions: ['No currency conversion'],
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.currency).toBe('EUR');
    expect(result.netReplacementBenefit).toBe(6000);
    expect(result).not.toHaveProperty('assetId');
  });

  const tools = [
    { name: 'UteamupFleetDashboardGetUtilization', args: {} },
    { name: 'UteamupFleetDashboardGetCompliance', args: {} },
    {
      name: 'UteamupFleetIntelligenceGetAnomalies',
      args: { lookbackDays: 60, minimumHistory: 8 },
    },
    {
      name: 'UteamupFleetIntelligenceGetTireReadiness',
      args: { assetGuid },
    },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
