'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('reliability risk MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'reliability-risk-token';
  const assetGuid = '11111111-1111-4111-8111-111111111111';
  const failureGuid = '22222222-2222-4222-8222-222222222222';
  const tool = {
    name: 'UteamupReliabilityRiskGet',
    args: {
      assetGuid,
      fromUtc: '2026-01-01T00:00:00Z',
      toUtc: '2026-07-17T00:00:00Z',
      limit: 10,
    },
  };
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('round-trips GUID-first evidence and explicit prediction gates', async () => {
    const response = await call(
      tool.name,
      tool.args,
      successReply({
        assetGuid,
        dataReadiness: 'limited',
        statisticalAnalysisEligible: false,
        validatedPredictiveModelEnabled: false,
        predictiveModelGateReason: 'More evidence and successful baseline backtesting are required.',
        badActors: [{
          assetGuid,
          assetName: 'Vehicle 17',
          riskScore: 87.5,
          evidenceFailureGuids: [failureGuid],
        }],
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.assetGuid).toBe(assetGuid);
    expect(result.validatedPredictiveModelEnabled).toBe(false);
    expect(result.badActors[0].evidenceFailureGuids).toEqual([failureGuid]);
    expect(result).not.toHaveProperty('assetId');
    expect(result.badActors[0]).not.toHaveProperty('id');
  });

  test('preserves backend permission denials', async () => {
    const response = await call(
      tool.name,
      tool.args,
      errorReply(-32000, 'Permission denied: Asset.View required.'),
    );

    expect(response.body.error.message).toMatch(/Asset\.View/);
  });

  const tools = [tool];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});

describe('reliability strategy MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'reliability-strategy-token';
  const assetGuid = '33333333-3333-4333-8333-333333333333';
  const failureGuid = '44444444-4444-4444-8444-444444444444';
  const tool = {
    name: 'UteamupReliabilityStrategyPropose',
    args: {
      assetGuid,
      objectiveKey: 'availability',
      fromUtc: '2026-01-01T00:00:00Z',
      toUtc: '2026-07-17T00:00:00Z',
    },
  };
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('round-trips review-only FMEA, RCM, PM and prediction gates', async () => {
    const response = await call(
      tool.name,
      tool.args,
      successReply({
        assetGuid,
        selectedStrategyKey: 'planned-preventive',
        recommendedPmIntervalDays: 24,
        fmeaEligible: true,
        fmecaEligible: false,
        statisticalGate: {
          weibullEligible: false,
          survivalAnalysisEligible: false,
          remainingUsefulLifeEligible: false,
          gateReason: 'More evidence is required.',
        },
        failureModes: [{
          failureModeKey: 'bearing',
          detectionScore: null,
          riskPriorityNumber: null,
          evidenceFailureGuids: [failureGuid],
        }],
        plan: {
          status: 'needs-review',
          recommendations: [{ proposedActions: [], requiresHumanConfirmation: true }],
        },
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.assetGuid).toBe(assetGuid);
    expect(result.fmecaEligible).toBe(false);
    expect(result.statisticalGate.remainingUsefulLifeEligible).toBe(false);
    expect(result.failureModes[0].riskPriorityNumber).toBeNull();
    expect(result.plan.status).toBe('needs-review');
    expect(result.plan.recommendations[0].proposedActions).toEqual([]);
    expect(result).not.toHaveProperty('assetId');
  });

  const tools = [tool];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
