'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Project schedule workspace MCP contracts', () => {
  const base = 'https://api.test.com';
  const token = 'schedule_test_actor';
  const projectGuid = '11111111-1111-1111-1111-111111111111';
  const requestGuid = '22222222-2222-2222-2222-222222222222';
  const dependencyGuid = '33333333-3333-3333-3333-333333333333';
  const expectedSnapshotFingerprint = 'a'.repeat(64);
  const model = { requestGuid, expectedSnapshotFingerprint, expectedReviewFingerprint: 'b'.repeat(64),
    reviewNote: 'Review supplier delay', changes: [{ node: { kind: 1, guid: dependencyGuid },
      expectedUpdatedAt: '2026-09-13T00:00:00Z', basis: 0, dates: { start: null, finish: '2026-09-18T16:00:00Z' } }] };
  const tools = [
    { name: 'UteamupProjectScheduleGet', args: { projectGuid } },
    { name: 'UteamupProjectSchedulePreview', args: { projectGuid, model } },
    { name: 'UteamupProjectScheduleApply', args: { projectGuid, model } },
    { name: 'UteamupProjectScheduleDependencySave', args: { projectGuid, dependencyGuid, model: {
      requestGuid, expectedSnapshotFingerprint, reviewNote: 'Link fabrication to equipment',
      predecessor: { kind: 0, guid: requestGuid }, successor: { kind: 2, guid: dependencyGuid }, type: 2, lagMinutes: 30 } } },
    { name: 'UteamupProjectScheduleDependencyRemove', args: { projectGuid, dependencyGuid, model: {
      requestGuid, expectedSnapshotFingerprint, reviewNote: 'Review removed relationship' } } },
    { name: 'UteamupProjectScheduleCalendarSet', args: { projectGuid, model: { requestGuid, expectedSnapshotFingerprint,
      reviewNote: 'Adopt factory calendar', calendar: { useWorkingTime: true, timeZoneId: 'Atlantic/Reykjavik',
        weeklyWindows: [{ dayOfWeek: 1, startMinute: 480, finishMinute: 960 }], holidayGuids: [] } } } },
    { name: 'UteamupProjectScheduleHistory', args: { projectGuid, page: 3, pageSize: 25 } },
  ];
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  const call = (name, args, reply) => callMcpTool(base, token, name, args, reply);

  test.each(tools)('$name preserves exact review identities, enums, nulls and pagination', async ({ name, args }) => {
    const response = await call(name, args, successReply(args));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(args);
  });

  test('does not manufacture unavailable dates or hide a blocking review', async () => {
    const review = { projectGuid, snapshotFingerprint: expectedSnapshotFingerprint, reviewFingerprint: 'c'.repeat(64),
      changes: [], issues: [{ code: 'publishedBookingEvidenceUnavailable', blocksApply: true }], publishedBookings: [] };
    const response = await call('UteamupProjectSchedulePreview', { projectGuid, model }, successReply(review));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(review);
  });

  test('retained history exposes its permission completeness', async () => {
    const history = { currentPage: 3, totalItems: 60, items: [{ actorName: 'Project owner', dateReview: null,
      isCompleteForViewer: false, unavailableSections: ['publishedBookings'] }] };
    const response = await call('UteamupProjectScheduleHistory', { projectGuid, page: 3, pageSize: 25 }, successReply(history));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(history);
  });

  test('stale review is retained as a backend error', async () => {
    const response = await call('UteamupProjectScheduleApply', { projectGuid, model }, errorReply(-32603, 'Review schedule again'));
    expect(response.body.error).toEqual(expect.objectContaining({ code: -32603, message: 'Review schedule again' }));
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(base, tools);
  describe503ServiceUnavailable(base, tools);
});
