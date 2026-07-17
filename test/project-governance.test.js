'use strict';

const nock = require('nock');
const {
  callMcpTool: callTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Project governance MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'project_governance_token';
  const PROJECT_GUID = '11111111-1111-1111-1111-111111111111';
  const RESOURCE_GUID = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    callTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const tools = [
    { name: 'UteamupProjectFieldContextGet', args: { projectGuid: PROJECT_GUID } },
    { name: 'UteamupProjectMembersList', args: { projectGuid: PROJECT_GUID } },
    { name: 'UteamupProjectMembersAdd', args: { projectGuid: PROJECT_GUID, model: { userGuid: RESOURCE_GUID, role: 2, allocationPercent: 50, startDate: '2026-07-09' } } },
    { name: 'UteamupProjectMembersUpdate', args: { projectGuid: PROJECT_GUID, memberGuid: RESOURCE_GUID, model: { role: 1, allocationPercent: 75, startDate: '2026-07-09', isActive: true } } },
    { name: 'UteamupProjectMembersRemove', args: { projectGuid: PROJECT_GUID, memberGuid: RESOURCE_GUID } },
    { name: 'UteamupProjectDependenciesList', args: { projectGuid: PROJECT_GUID } },
    { name: 'UteamupProjectDependenciesAdd', args: { projectGuid: PROJECT_GUID, model: { predecessorWorkorderGuid: RESOURCE_GUID, successorWorkorderGuid: '33333333-3333-3333-3333-333333333333', dependencyType: 0, lagMinutes: 0 } } },
    { name: 'UteamupProjectDependenciesRemove', args: { projectGuid: PROJECT_GUID, dependencyGuid: RESOURCE_GUID } },
    { name: 'UteamupProjectActivityList', args: { projectGuid: PROJECT_GUID, limit: 100 } },
    { name: 'UteamupProjectCommentsList', args: { projectGuid: PROJECT_GUID } },
    { name: 'UteamupProjectCommentsAdd', args: { projectGuid: PROJECT_GUID, model: { text: 'Decision recorded', isDecision: true, mentionedUserGuids: [] } } },
    { name: 'UteamupProjectCommentsUpdate', args: { projectGuid: PROJECT_GUID, commentGuid: RESOURCE_GUID, model: { text: 'Updated decision', isDecision: true, mentionedUserGuids: [] } } },
    { name: 'UteamupProjectCommentsRemove', args: { projectGuid: PROJECT_GUID, commentGuid: RESOURCE_GUID } },
    { name: 'UteamupProjectBaselinesList', args: { projectGuid: PROJECT_GUID } },
    { name: 'UteamupProjectBaselinesCapture', args: { projectGuid: PROJECT_GUID, model: { label: 'Approved plan' } } },
    { name: 'UteamupProjectVarianceGet', args: { projectGuid: PROJECT_GUID, baselineGuid: RESOURCE_GUID } },
    { name: 'UteamupProjectChangeRequestsList', args: { projectGuid: PROJECT_GUID } },
    { name: 'UteamupProjectChangeRequestsCreate', args: { projectGuid: PROJECT_GUID, model: { summary: 'Move finish date', reason: 'Supplier delay', proposedChanges: { endDate: '2026-09-01' } } } },
    { name: 'UteamupProjectChangeRequestsSubmit', args: { projectGuid: PROJECT_GUID, requestGuid: RESOURCE_GUID } },
    { name: 'UteamupProjectChangeRequestsApprove', args: { projectGuid: PROJECT_GUID, requestGuid: RESOURCE_GUID } },
    { name: 'UteamupProjectChangeRequestsReject', args: { projectGuid: PROJECT_GUID, requestGuid: RESOURCE_GUID } },
    { name: 'UteamupProjectChangeRequestsApply', args: { projectGuid: PROJECT_GUID, requestGuid: RESOURCE_GUID } },
  ];

  const listTools = tools.filter(({ name }) => name.endsWith('List'));

  test.each(tools)('$name forwards arguments and returns a success result', async ({ name, args }) => {
    const response = await call(name, args, successReply({ ok: true }));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual({ ok: true });
  });

  test.each(listTools)('$name preserves an empty list', async ({ name, args }) => {
    const response = await call(name, args, successReply([]));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });

  test('UteamupProjectFieldContextGet preserves deterministic GUID evidence', async () => {
    const fieldContext = {
      projectGuid: PROJECT_GUID,
      currentStage: { stageGuid: RESOURCE_GUID, name: 'Commissioning' },
      hasCriticalPathWarning: true,
      budget: { signal: 'Watch' },
      evidenceComputedAt: '2026-07-17T09:30:00Z',
    };

    const response = await call(
      'UteamupProjectFieldContextGet',
      { projectGuid: PROJECT_GUID },
      successReply(fieldContext),
    );

    expect(JSON.parse(response.body.result.content[0].text)).toEqual(fieldContext);
  });

  test.each(tools)('$name preserves backend JSON-RPC errors', async ({ name, args }) => {
    const response = await call(name, args, errorReply(-32603, 'Project governance operation failed'));
    expect(response.body.error).toEqual(expect.objectContaining({ code: -32603 }));
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
