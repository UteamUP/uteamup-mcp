'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  errorReply,
  sendRawRequest,
  successReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Shift-handover operational metrics MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'shift_handover_operational_metrics_token';
  const args = {
    fromDate: '2026-06-13T12:00:00Z',
    toDate: '2026-07-13T12:00:00Z',
  };
  const tools = [{ name: 'UteamupShiftHandoverGetStats', args }];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  test('returns deterministic SLA evidence and preserves unavailable scores', async () => {
    const metrics = {
      generatedAtUtc: '2026-07-13T12:01:00Z',
      fromUtc: '2026-06-13T12:00:00Z',
      toUtc: '2026-07-13T12:00:00Z',
      slaPolicySource: 'systemDefault',
      acceptanceSlaMinutes: 30,
      totalHandovers: 5,
      currentOverdueCount: 2,
      acceptanceSlaEligibleCount: 5,
      acceptedWithinSlaCount: 4,
      acceptanceSlaRatePercent: 80,
      qualityScoreCoverageCount: 0,
      averageQualityScore: null,
      complianceScoreCoverageCount: 4,
      averageComplianceScore: 92.5,
      dailyMetrics: [
        {
          dateUtc: '2026-07-12T00:00:00Z',
          totalCount: 2,
          completedCount: 1,
          rejectedCount: 1,
          correctionCount: 1,
          currentOverdueCount: 2,
        },
      ],
    };

    const response = await call(
      'UteamupShiftHandoverGetStats',
      args,
      successReply(metrics),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result).toEqual(metrics);
    expect(result.averageQualityScore).toBeNull();
    expect(result.acceptedWithinSlaCount).toBe(4);
    expect(result.dailyMetrics[0].correctionCount).toBe(1);
    expect(JSON.stringify(result)).not.toMatch(/tenantId|handoverId|userId/);
  });

  test('forwards the optional UTC reporting window without invented arguments', async () => {
    let captured = null;
    nock(BASE_URL)
      .post('/mcp', body => {
        captured = body;
        return body.params?.name === 'UteamupShiftHandoverGetStats';
      })
      .reply(200, JSON.stringify(successReply({ totalHandovers: 0 }).body), {
        'Content-Type': 'application/json',
      });

    await sendRawRequest(
      BASE_URL,
      'UteamupShiftHandoverGetStats',
      args,
    );

    expect(captured.params).toEqual({
      name: 'UteamupShiftHandoverGetStats',
      arguments: args,
    });
  });

  test('preserves invalid reporting-window errors from the backend', async () => {
    const response = await call(
      'UteamupShiftHandoverGetStats',
      args,
      errorReply(-32602, 'fromDate must be earlier than toDate.'),
    );

    expect(response.body.error.code).toBe(-32602);
    expect(response.body.error.message).toBe(
      'fromDate must be earlier than toDate.',
    );
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
