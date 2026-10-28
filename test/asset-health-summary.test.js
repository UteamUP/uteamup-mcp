'use strict';
const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const { describe401Unauthorized } = require('./helpers/mcp-error-tests');
const origin = 'https://api.uteamup.com';
const tool = 'UteamupInspectionAssetHealthSummary';
describe('Tenant asset inspection health summary', () => {
  beforeAll(() => nock.disableNetConnect());
  afterAll(() => nock.enableNetConnect());
  afterEach(() => nock.cleanAll());
  test('preserves absent health and the complete unscored denominator', async () => {
    const summary = { totalAssets: 70, activeAssets: 40, activePercent: 57, averageHealthScore: null,
      scoredAssets: 0, unscoredAssets: 70, openAnomalies: 0, criticalAnomalies: 0, inspectionSampleLimit: 50 };
    const response = await callMcpTool(origin, 'analytics-reader', tool, {}, successReply(summary), {});
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(summary);
    expect(nock.isDone()).toBe(true);
  });
  describe401Unauthorized(origin, [{ name: tool, args: {} }]);
});
