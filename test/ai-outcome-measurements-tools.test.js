/** Tenant AI outcome measurement MCP proxy contract tests. */
'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('tenant AI outcome measurement MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_ai_outcomes';
  const tool = { name: 'UteamupAIOutcomeMeasurements', args: { domain: 'fleet', status: 'Measured', limit: 25 } };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  test('passes through prediction, actual value, error and GUID evidence', async () => {
    const outcomeGuid = '11111111-1111-4111-8111-111111111111';
    const response = await call(tool.name, tool.args, successReply([{
      outcomeGuid,
      domain: 'fleet', capabilityKey: 'fleet.cost.analyze', metricKey: 'maintenance-cost',
      unit: 'ISK', baselineValue: 100000, predictedValue: 85000, actualValue: 90000,
      predictedChange: -15000, actualChange: -10000, absolutePredictionError: 5000,
      achievementPercent: 66.67, status: 2, dataSource: 'workorder-cost-rollup',
      measurementWindowStartUtc: '2026-07-01T00:00:00Z',
      measurementWindowEndUtc: '2026-07-31T00:00:00Z',
    }]));
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data[0].outcomeGuid).toBe(outcomeGuid);
    expect(data[0].actualValue).toBe(90000);
    expect(data[0].absolutePredictionError).toBe(5000);
  });

  test('passes through an honest empty result', async () => {
    const response = await call(tool.name, { domain: 'stock', status: 'Measured' }, successReply([]));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });

  test('passes through permission denial', async () => {
    const response = await call(tool.name, tool.args, errorReply(-32000, 'Permission denied: AIUsage.ViewTenant required'));
    expect(response.body.error.message).toMatch(/AIUsage\.ViewTenant/i);
  });

  const tools = [tool];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
