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

describe('reliability evidence and governed-run MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'reliability-evidence-token';
  const assetGuid = '55555555-5555-4555-8555-555555555555';
  const versionGuid = '66666666-6666-4666-8666-666666666666';
  const requestGuid = '77777777-7777-4777-8777-777777777777';
  const runRequestGuid = '88888888-8888-4888-8888-888888888888';
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('round-trips versioned assessment evidence without integer identities', async () => {
    const response = await call(
      'UteamupReliabilityAssessmentsList',
      { assetGuid, includeHistory: true },
      successReply([{
        assessmentGuid: requestGuid,
        versionGuid,
        version: 2,
        assetGuid,
        failureModeKey: 'bearing-fatigue',
        status: 'approved',
        evidenceReferenceGuids: [requestGuid],
      }]),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result[0].assetGuid).toBe(assetGuid);
    expect(result[0].versionGuid).toBe(versionGuid);
    expect(result[0]).not.toHaveProperty('id');
    expect(result[0]).not.toHaveProperty('assetId');
  });

  test('round-trips draft creation and exact-version approval', async () => {
    const createArgs = {
      requestGuid,
      assetGuid,
      failureModeKey: 'bearing-fatigue',
      failureModeName: 'Bearing fatigue',
      severityScore: 8,
      detectabilityScore: 6,
      consequenceScore: 7,
      evidenceReferenceGuids: [requestGuid],
    };
    const created = await call(
      'UteamupReliabilityAssessmentCreate',
      createArgs,
      successReply({
        assessmentGuid: requestGuid,
        versionGuid,
        version: 1,
        assetGuid,
        status: 'draft',
      }),
    );
    const createdResult = JSON.parse(created.body.result.content[0].text);
    expect(createdResult.status).toBe('draft');

    const approved = await call(
      'UteamupReliabilityAssessmentApprove',
      { versionGuid, requestGuid: runRequestGuid, expectedVersion: 1 },
      successReply({
        assessmentGuid: requestGuid,
        versionGuid: runRequestGuid,
        version: 2,
        assetGuid,
        status: 'approved',
      }),
    );
    const approvedResult = JSON.parse(approved.body.result.content[0].text);
    expect(approvedResult.status).toBe('approved');
    expect(approvedResult.version).toBe(2);
  });

  test('round-trips durable-run readiness without implying execution', async () => {
    const response = await call(
      'UteamupReliabilityStrategyPrepareRun',
      {
        requestGuid,
        runRequestGuid,
        assetGuid,
        objectiveKey: 'availability',
      },
      successReply({
        planGuid: requestGuid,
        durableRunGuid: runRequestGuid,
        status: 'awaiting-approval',
        readyForExecution: false,
        withheldReasons: ['Approval is required before execution.'],
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.durableRunGuid).toBe(runRequestGuid);
    expect(result.status).toBe('awaiting-approval');
    expect(result.readyForExecution).toBe(false);
  });

  const tools = [
    {
      name: 'UteamupReliabilityAssessmentsList',
      args: { assetGuid, includeHistory: false },
    },
    {
      name: 'UteamupReliabilityAssessmentCreate',
      args: {
        requestGuid,
        assetGuid,
        failureModeKey: 'bearing-fatigue',
        failureModeName: 'Bearing fatigue',
        severityScore: 8,
        detectabilityScore: 6,
      },
    },
    {
      name: 'UteamupReliabilityAssessmentApprove',
      args: { versionGuid, requestGuid, expectedVersion: 1 },
    },
    {
      name: 'UteamupReliabilityStrategyPrepareRun',
      args: { requestGuid, runRequestGuid, assetGuid, objectiveKey: 'availability' },
    },
  ];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
