'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Report catalog MCP read', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'report-catalog-token';
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply, toolArgs);
  const analyticsArgs = { startDate: '2026-01-01', endDate: '2026-12-31', groupBy: 'quarter' };
  const generateArgs = {
    reportType: 'WorkOrderSummary',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('round-trips available report metadata without identifier arguments', async () => {
    const response = await call(
      'UteamupReportList',
      {},
      successReply([{
        reportType: 'WorkOrderSummary',
        displayName: 'Work order summary',
        description: 'Summary of work orders',
        isAvailable: true,
        requiredFilters: ['StartDate', 'EndDate'],
        optionalFilters: ['Status'],
      }]),
    );

    const [report] = JSON.parse(response.body.result.content[0].text);
    expect(report.reportType).toBe('WorkOrderSummary');
    expect(report.requiredFilters).toEqual(['StartDate', 'EndDate']);
  });

  test('round-trips asset report history with a public GUID argument', async () => {
    const assetGuid = '7b7fbd71-4ecf-4c3e-9e36-b87d447ab117';
    const response = await call(
      'UteamupAssetReports',
      { assetGuid, page: 1, pageSize: 20 },
      successReply({ assetGuid, totalReports: 0, reports: [] }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.assetGuid).toBe(assetGuid);
    expect(result).not.toHaveProperty('assetId');
  });

  test('round-trips quarterly report analytics with the inclusive end date', async () => {
    const analytics = {
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-12-31T00:00:00Z',
      groupBy: 'quarter',
      totalReports: 3,
      totalCost: 1250.75,
      totalTimeSpent: 9.5,
      averageCompletionRate: 0.8,
      isCostPartial: false,
      costTrends: [
        { period: '2026-Q1', periodStart: '2026-01-01T00:00:00Z', reportCount: 2, labourCost: 400, travelCost: 50, partsCost: 300, toolsCost: 0, totalCost: 750, averageTimeSpent: 3 },
        { period: '2026-Q4', periodStart: '2026-10-01T00:00:00Z', reportCount: 1, labourCost: 300, travelCost: 0, partsCost: 200.75, toolsCost: 0, totalCost: 500.75, averageTimeSpent: 3.5 },
      ],
      topAssetsByCost: [],
      reportsByMaintenanceType: [],
    };

    const response = await call('UteamupReportAnalytics', analyticsArgs, successReply(analytics));

    expect(nock.isDone()).toBe(true);
    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.groupBy).toBe('quarter');
    expect(result.endDate).toBe('2026-12-31T00:00:00Z');
    expect(result.costTrends.map(trend => trend.period)).toEqual(['2026-Q1', '2026-Q4']);
    expect(result.costTrends[0]).toHaveProperty('travelCost', 50);
    expect(result.isCostPartial).toBe(false);
  });

  test('round-trips daily report analytics and a partial-cost flag', async () => {
    const args = { startDate: '2026-09-01', endDate: '2026-09-02', groupBy: 'day' };
    const analytics = {
      startDate: '2026-09-01T00:00:00Z',
      endDate: '2026-09-02T00:00:00Z',
      groupBy: 'day',
      totalReports: 2,
      totalCost: 90,
      totalTimeSpent: 2,
      averageCompletionRate: 1,
      isCostPartial: true,
      costTrends: [
        { period: '2026-09-01', periodStart: '2026-09-01T00:00:00Z', reportCount: 1, totalCost: 40 },
        { period: '2026-09-02', periodStart: '2026-09-02T00:00:00Z', reportCount: 1, totalCost: 50 },
      ],
      topAssetsByCost: [],
      reportsByMaintenanceType: [],
    };

    const response = await call('UteamupReportAnalytics', args, successReply(analytics));

    expect(nock.isDone()).toBe(true);
    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.groupBy).toBe('day');
    expect(result.costTrends.map(trend => trend.period)).toEqual(['2026-09-01', '2026-09-02']);
    expect(result.isCostPartial).toBe(true);
  });

  test('round-trips a generated registered report with GUID row references', async () => {
    const reportGuid = '9c1a5b4e-1f7d-4b2a-8c3e-5d6f7a8b9c0d';
    const workorderGuid = '0e1f2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b';
    const generated = {
      reportKey: 'WorkOrderSummary',
      displayName: 'Work order summary',
      description: 'Summary of work orders',
      startDateUtc: '2026-09-01T00:00:00Z',
      endDateUtc: '2026-09-30T00:00:00Z',
      generatedAtUtc: '2026-09-24T08:00:00Z',
      rowCount: 1,
      truncated: false,
      rows: [{
        rowType: 'Report',
        key: reportGuid,
        label: 'Replace pump seal',
        reportGuid,
        workorderGuid,
        workorderName: 'Replace pump seal',
        eventDateUtc: '2026-09-23T14:30:00Z',
        status: 'Completed',
        timeSpentHours: 1.5,
        cost: 240.5,
      }],
    };

    const response = await call('UteamupReportGenerate', generateArgs, successReply(generated));

    expect(nock.isDone()).toBe(true);
    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.reportKey).toBe('WorkOrderSummary');
    expect(result.rowCount).toBe(1);
    expect(result.rows[0].reportGuid).toBe(reportGuid);
    expect(result.rows[0].workorderGuid).toBe(workorderGuid);
    expect(result.rows[0]).not.toHaveProperty('reportId');
    expect(result.rows[0]).not.toHaveProperty('workorderId');
  });

  const tools = [
    { name: 'UteamupReportList', args: {} },
    {
      name: 'UteamupAssetReports',
      args: { assetGuid: '7b7fbd71-4ecf-4c3e-9e36-b87d447ab117', page: 1, pageSize: 20 },
    },
    { name: 'UteamupReportAnalytics', args: analyticsArgs },
    { name: 'UteamupReportGenerate', args: generateArgs },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
