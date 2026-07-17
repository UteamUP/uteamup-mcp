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

  const tools = [
    { name: 'UteamupFleetDashboardGetUtilization', args: {} },
    { name: 'UteamupFleetDashboardGetCompliance', args: {} },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
