'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Project timeline and scoped workflow contracts', () => {
  const base = 'https://api.test.com';
  const projectGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const itemGuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const model = { startDate: null, dueDate: '2026-09-15T00:00:00Z', expectedUpdatedAt: '2026-09-09T09:00:00.123456Z' };
  const cases = [
    { name: 'UteamupProjectTimelineStageSchedule', args: { projectGuid, stageGuid: itemGuid, model } },
    { name: 'UteamupProjectTimelineWorkorderSchedule', args: { projectGuid, workorderGuid: itemGuid, model: { ...model, startDate: '2026-09-14T00:00:00Z' } } },
    { name: 'UteamupAutomationSearch', args: { projectGuid, pageNumber: 2, pageSize: 20 } },
  ];
  const call = (name, args, reply) => callMcpTool(base, 'test_project_token', name, args, reply, args);
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  for (const { name, args } of cases) {
    test(`${name} forwards GUIDs and revision without tenant spoofing`, async () => {
      const result = { guid: itemGuid, projectGuid, ...model, updatedAt: model.expectedUpdatedAt };
      const response = await call(name, args, successReply(result));
      expect(JSON.parse(response.body.result.content[0].text)).toEqual(result);
      expect(args).not.toHaveProperty('tenantId');
      expect(args).not.toHaveProperty('userId');
      expect(nock.isDone()).toBe(true);
    });
    test(`${name} preserves not-found and conflict outcomes`, async () => {
      const empty = await call(name, args, successReply(null));
      expect(JSON.parse(empty.body.result.content[0].text)).toBeNull();
      const failure = await call(name, args, errorReply(-32603, 'Schedule changed'));
      expect(failure.body.error.message).toBe('Schedule changed');
    });
  }
  describeJsonRpcCompliance(call, cases);
  describe401Unauthorized(base, cases);
  describe503ServiceUnavailable(base, cases);
});
