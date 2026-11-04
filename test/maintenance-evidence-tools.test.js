'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Measured maintenance evidence contracts', () => {
  const base = 'https://api.test.com';
  const call = (name, args, reply) => callMcpTool(base, 'test-metric-token', name, args, reply, args);
  const tools = [
    { name: 'UteamupAnalyticsPmScheduleCompliance', args: { timeframe: '30d' }, field: 'compliancePercent' },
    { name: 'UteamupAnalyticsMaintenanceBacklogWeeks', args: {}, field: 'backlogWeeks' },
    { name: 'UteamupAnalyticsEmergencyWorkPercentage', args: {
      startUtc: '2026-11-01T00:00:00Z', endUtc: '2026-11-04T00:00:00Z'
    }, field: 'emergencyPercentage' },
    { name: 'UteamupAnalyticsMeanTimeToFirstFailure', args: {}, field: 'mttfHours' },
    { name: 'UteamupAnalyticsStockoutTimeRate', args: {
      startUtc: '2026-11-01T00:00:00Z', endUtc: '2026-11-04T00:00:00Z'
    }, field: 'stockoutPercentage' }
  ];
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  for (const tool of tools) {
    test(tool.name + ' preserves measured values and exact bounded arguments', async () => {
      const response = await call(tool.name, tool.args, successReply({ [tool.field]: 25 }));
      expect(JSON.parse(response.body.result.content[0].text)[tool.field]).toBe(25);
      expect(tool.args).not.toHaveProperty('tenantId');
      expect(tool.args).not.toHaveProperty('tenantGuid');
      expect(tool.args).not.toHaveProperty('userId');
    });
    test(tool.name + ' retains unavailable empty or incomplete coverage', async () => {
      const response = await call(tool.name, tool.args, successReply({ [tool.field]: null }));
      expect(JSON.parse(response.body.result.content[0].text)[tool.field]).toBeNull();
    });
    test(tool.name + ' preserves permission errors', async () => {
      const response = await call(tool.name, tool.args, errorReply(-32001, 'Source permission required'));
      expect(response.body.error.code).toBe(-32001);
    });
  }

  test.each([true, false, null])('workorder update retains explicit emergency classification %s', async isEmergency => {
    const args = { workorderGuid: 'ba84d3c3-1b18-41de-b824-4f981477a805', model: { isEmergency } };
    const response = await call('UteamupWorkorderUpdate', args, successReply({ isEmergency }));
    expect(JSON.parse(response.body.result.content[0].text).isEmergency).toBe(isEmergency);
  });
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(base, tools);
  describe503ServiceUnavailable(base, tools);
});
