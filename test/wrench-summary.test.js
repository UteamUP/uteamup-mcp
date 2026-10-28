'use strict';
const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const { describe401Unauthorized } = require('./helpers/mcp-error-tests');
const origin = 'https://api.uteamup.com';
const tool = 'UteamupTimeEntryWrenchSummary';
describe('Company and team recorded wrench time', () => {
  beforeAll(() => nock.disableNetConnect());
  afterAll(() => nock.enableNetConnect());
  afterEach(() => nock.cleanAll());
  test('preserves company-local filters, full totals and missing capacity', async () => {
    const args = { dateFrom: '2026-10-01', dateTo: '2026-10-28', teamGuid: '24f69ca1-e664-421e-ac0d-47ee64d7d725', page: 2, pageSize: 10 };
    const summary = { dateFrom: '2026-10-01T00:00:00Z', dateTo: '2026-10-29T00:00:00Z', timeZoneId: 'Atlantic/Reykjavik',
      teamGuid: args.teamGuid, totals: { totalSeconds: 0, productiveSeconds: 0, nonProductiveSeconds: 0,
        productivePercent: null, unallocatedEntryCount: 1, capacitySeconds: null, utilizationPercent: null },
      workers: [], page: 2, pageSize: 10, totalWorkers: 27, totalPages: 3 };
    const response = await callMcpTool(origin, 'time-reader', tool, args, successReply(summary), args);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(summary);
    expect(nock.isDone()).toBe(true);
  });
  describe401Unauthorized(origin, [{ name: tool, args: { dateFrom: '2026-10-01', dateTo: '2026-10-28' } }]);
});
