/** Tenant AI data-readiness MCP proxy contract tests. */
'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('tenant AI data-readiness MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_ai_readiness';
  const tool = { name: 'UteamupAIDataReadiness', args: {} };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  test('passes through weighted scores, signals and actionable issues', async () => {
    const response = await call(tool.name, tool.args, successReply({
      evaluatedAtUtc: '2026-07-16T13:30:00Z',
      overallScore: 71,
      level: 'evidence-building',
      predictiveFeaturesEligible: false,
      domains: [{
        domain: 'fleet', score: 54, level: 'insufficient', weight: 15,
        predictiveFeaturesEligible: false,
        signals: [{ code: 'fleet.meters.coverage', score: 40, readyRecords: 4, relevantRecords: 10, targetPercent: 80 }],
        issues: [{ code: 'fleet.meters.missing', severity: 'critical', ownerDomain: 'fleet', affectedRecords: 6 }],
      }],
    }));

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.overallScore).toBe(71);
    expect(data.predictiveFeaturesEligible).toBe(false);
    expect(data.domains[0].signals[0].relevantRecords).toBe(10);
    expect(data.domains[0].issues[0].affectedRecords).toBe(6);
  });

  test('passes through a valid empty-domain assessment', async () => {
    const response = await call(tool.name, tool.args, successReply({
      evaluatedAtUtc: '2026-07-16T13:30:00Z', overallScore: 0,
      level: 'insufficient', predictiveFeaturesEligible: false, domains: [],
    }));
    expect(response.status).toBe(200);
  });

  test('passes through permission denial', async () => {
    const response = await call(
      tool.name,
      tool.args,
      errorReply(-32000, 'Permission denied: AIUsage.ViewTenant required'),
    );
    expect(response.body.error.message).toMatch(/AIUsage\.ViewTenant/i);
  });

  const tools = [tool];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
