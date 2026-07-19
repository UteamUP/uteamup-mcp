/**
 * Operations Brain MCP proxy contracts.
 *
 * The backend owns tenant scope, deterministic planning, evidence freshness,
 * scenario scoring, and durable-run preparation. The proxy must preserve the
 * GUID-only, version-bound arguments unchanged.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool,
  sendRawRequest,
  successReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Operations Brain planning tools', () => {
  const baseUrl = 'https://api.test.com';
  const accessToken = 'test_access_token_operations_planning';
  const planGuid = '11111111-1111-4111-8111-111111111111';
  const scenarioGuid = '22222222-2222-4222-8222-222222222222';
  const requestGuid = '33333333-3333-4333-8333-333333333333';
  const entityGuid = '44444444-4444-4444-8444-444444444444';
  const tools = [
    {
      name: 'UteamupOperationsGetRisks',
      args: {
        domains: ['assets', 'safety'],
        affectedEntityGuids: [entityGuid],
        evidenceMaxAgeMinutes: 1440,
      },
    },
    {
      name: 'UteamupOperationsCreatePlan',
      args: {
        requestGuid,
        objectiveKey: 'reduce-risk',
        title: 'Compare safe response plans',
        domains: ['assets', 'safety'],
        summary: 'Use current evidence',
        successMeasure: 'Reduce critical downtime',
        affectedEntityGuids: [entityGuid],
        siteGuids: [],
        evidenceMaxAgeMinutes: 1440,
      },
    },
    {
      name: 'UteamupOperationsGetPlan',
      args: { planGuid },
    },
    {
      name: 'UteamupOperationsSelectScenario',
      args: { planGuid, scenarioGuid, requestGuid, expectedVersion: 1 },
    },
    {
      name: 'UteamupOperationsPrepareRun',
      args: { planGuid, requestGuid, expectedVersion: 2 },
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    callMcpTool(baseUrl, accessToken, toolName, toolArgs, mockReply);

  it('preserves evidence readiness and GUID-only plan identity', async () => {
    const response = await call(
      'UteamupOperationsGetPlan',
      { planGuid },
      successReply({
        planGuid,
        requestGuid,
        evidenceSnapshotGuid: entityGuid,
        version: 2,
        evidenceVersion: 1,
        readiness: {
          isReady: false,
          withheldReasons: ['Evidence is stale.'],
        },
        scenarios: [],
      }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.planGuid).toBe(planGuid);
    expect(data.planId).toBeUndefined();
    expect(data.tenantId).toBeUndefined();
    expect(data.readiness.isReady).toBe(false);
    expect(data.readiness.withheldReasons).toEqual(['Evidence is stale.']);
  });

  it('preserves an empty risk response', async () => {
    const response = await call(
      'UteamupOperationsGetRisks',
      { domains: ['assets'] },
      successReply([]),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toEqual([]);
  });

  it('forwards version-bound run preparation without scope spoofing', async () => {
    let captured;
    nock(baseUrl)
      .post('/mcp', body => {
        captured = body;
        return true;
      })
      .reply(200, JSON.stringify(successReply({
        planGuid,
        durableRunGuid: entityGuid,
        version: 3,
        status: 'awaiting-approval',
      }).body), {
        'Content-Type': 'application/json',
      });

    await sendRawRequest(
      baseUrl,
      'UteamupOperationsPrepareRun',
      { planGuid, requestGuid, expectedVersion: 2 },
    );

    expect(captured.params.arguments).toEqual({
      planGuid,
      requestGuid,
      expectedVersion: 2,
    });
    expect(captured.params.arguments.tenantGuid).toBeUndefined();
    expect(captured.params.arguments.userId).toBeUndefined();
    expect(captured.params.arguments.planId).toBeUndefined();
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
