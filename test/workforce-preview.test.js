'use strict';
const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');
const baseUrl = 'https://api.uteamup.com';
const guid = 'aaaaaaaa-1111-4111-8111-111111111111';
const model = { idempotencyKey: guid, expectedUpdatedAt: '2026-11-10T12:00:00Z' };
const tools = [
  { name: 'UteamupTimeEntryReviewList', args: { page: 1, pageSize: 25 } },
  { name: 'UteamupTimeEntryDecide', args: { entryGuid: guid, decision: 'request-info', model, message: 'Please identify the work.' } },
  { name: 'UteamupTimeEntryReviewContext', args: { entryGuid: guid, model: { ...model, costAttribution: { allocations: [] } } } },
  { name: 'UteamupTimeEntryCostReport', args: { from: '2026-11-01', to: '2026-11-10', dimension: 'target' } },
  { name: 'UteamupWorkforceAbsenceReport', args: { query: { from: '2026-11-01', to: '2026-11-10' } } },
  { name: 'UteamupWorkforceAbsenceCreate', args: { model: { startDate: '2026-11-11', endDate: '2026-11-12', overrideType: 'medical', minutesPerDay: 120 } } },
  { name: 'UteamupWorkforceAbsenceDecide', args: { overrideGuid: guid, approved: true, expectedUpdatedAt: model.expectedUpdatedAt } },
  { name: 'UteamupWorkforceManagerPosition', args: { assignmentGuid: guid } },
  { name: 'UteamupWorkerPresenceList', args: { page: 1, pageSize: 50 } },
  { name: 'UteamupWorkerPresenceMine', args: {} },
  { name: 'UteamupWorkerPresenceDeclare', args: { model: { mode: 'home', expiresAtUtc: '2026-11-10T20:00:00Z', expectedUpdatedAt: model.expectedUpdatedAt } } },
];
const call = (name, args, reply) => callMcpTool(baseUrl, 'test-token', name, args, reply);
afterEach(() => nock.cleanAll());
test.each(tools)('$name preserves preview data, empty and denied responses', async tool => {
  const result = await call(tool.name, tool.args, successReply({ isPreview: true, items: [], latitude: null, totalCost: null }));
  expect(JSON.parse(result.body.result.content[0].text)).toEqual({ isPreview: true, items: [], latitude: null, totalCost: null });
  const denied = await call(tool.name, tool.args, errorReply(-32003, 'Access denied'));
  expect(denied.body.error.message).toContain('denied');
});
describeJsonRpcCompliance(call, tools);
describe401Unauthorized(baseUrl, tools);
describe503ServiceUnavailable(baseUrl, tools);
