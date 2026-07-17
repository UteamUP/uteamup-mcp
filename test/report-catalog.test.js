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
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

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

  const tools = [{ name: 'UteamupReportList', args: {} }];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
