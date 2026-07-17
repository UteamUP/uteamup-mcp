'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('VehicleInspection overdue MCP read', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'vehicle-inspection-overdue-token';
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('round-trips the tenant-scoped read without identifier arguments', async () => {
    const response = await call(
      'UteamupVehicleInspectionGetOverdue',
      {},
      successReply([{
        assetId: 42,
        assetName: 'Service van 7',
        complianceType: 'Daily Pre-Trip / DVIR',
        dueDate: '2026-07-16T09:00:00Z',
        status: 'Overdue',
        lastInspectionDate: '2026-07-15T09:00:00Z',
      }]),
    );

    const [item] = JSON.parse(response.body.result.content[0].text);
    expect(item.assetName).toBe('Service van 7');
    expect(item.status).toBe('Overdue');
  });

  const tools = [{ name: 'UteamupVehicleInspectionGetOverdue', args: {} }];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
