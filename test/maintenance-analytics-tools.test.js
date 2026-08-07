/**
 * Proxy contract tests for the live backend MaintenanceAnalyticsTools schema.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: callMcpToolRequest,
  successReply,
  errorReply
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
} = require('./helpers/mcp-error-tests');

describe('Maintenance analytics MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_analytics';
  const ASSET_GUID = '11111111-1111-4111-8111-111111111111';
  const LOCATION_GUID = '22222222-2222-4222-8222-222222222222';
  const TOOL_NAME = 'UteamupAnalyticsMaintenanceTypeDistribution';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    callMcpToolRequest(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const distribution = {
    totalWorkorders: 5,
    classifiedWorkorders: 4,
    unclassifiedWorkorders: 1,
    byType: [
      {
        maintenanceType: 'PreventiveScheduled',
        displayName: 'Preventive scheduled maintenance',
        category: 'Preventive',
        categoryDisplayName: 'Preventive maintenance',
        count: 3,
        percentage: 75
      }
    ],
    byCategory: [
      {
        category: 'Preventive',
        displayName: 'Preventive maintenance',
        count: 3,
        percentage: 75
      }
    ]
  };

  test('returns the live maintenance type distribution response', async () => {
    const response = await call(
      TOOL_NAME,
      {},
      successReply(distribution)
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(response.status).toBe(200);
    expect(data.totalWorkorders).toBe(5);
    expect(data.classifiedWorkorders).toBe(4);
    expect(data.byType).toHaveLength(1);
    expect(data.byCategory).toHaveLength(1);
  });

  test('forwards date and tenant-scoped GUID filters', async () => {
    const args = {
      dateFrom: '2026-01-01T00:00:00Z',
      dateTo: '2026-02-01T00:00:00Z',
      assetGuid: ASSET_GUID,
      locationGuid: LOCATION_GUID
    };
    const response = await call(TOOL_NAME, args, successReply(distribution));

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(distribution);
    expect(args).not.toHaveProperty('assetId');
    expect(args).not.toHaveProperty('locationId');
  });

  test('returns an empty distribution without inventing records', async () => {
    const empty = {
      totalWorkorders: 0,
      classifiedWorkorders: 0,
      unclassifiedWorkorders: 0,
      byType: [],
      byCategory: []
    };
    const response = await call(TOOL_NAME, {}, successReply(empty));

    expect(JSON.parse(response.body.result.content[0].text)).toEqual(empty);
  });

  test('surfaces tenant-scoped filter lookup failures', async () => {
    const response = await call(
      TOOL_NAME,
      { assetGuid: ASSET_GUID },
      errorReply(-32000, 'Asset was not found in the tenant')
    );

    expect(response.body.error.message).toContain('not found in the tenant');
  });

  const allTools = [
    {
      name: TOOL_NAME,
      args: { assetGuid: ASSET_GUID, locationGuid: LOCATION_GUID }
    }
  ];

  test('contains only the backend-registered maintenance analytics tool', () => {
    expect(allTools.map(tool => tool.name)).toEqual([TOOL_NAME]);
  });

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
