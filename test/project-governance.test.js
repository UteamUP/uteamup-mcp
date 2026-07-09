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
    { name: 'uteamup_project_members_list', args: { project_guid: PROJECT_GUID } },
    { name: 'uteamup_project_members_add', args: { project_guid: PROJECT_GUID, model: { userGuid: RESOURCE_GUID, role: 2, allocationPercent: 50, startDate: '2026-07-09' } } },
    { name: 'uteamup_project_members_update', args: { project_guid: PROJECT_GUID, member_guid: RESOURCE_GUID, model: { role: 1, allocationPercent: 75, startDate: '2026-07-09', isActive: true } } },
    { name: 'uteamup_project_members_remove', args: { project_guid: PROJECT_GUID, member_guid: RESOURCE_GUID } },
    { name: 'uteamup_project_dependencies_list', args: { project_guid: PROJECT_GUID } },
    { name: 'uteamup_project_dependencies_add', args: { project_guid: PROJECT_GUID, model: { predecessorWorkorderGuid: RESOURCE_GUID, successorWorkorderGuid: '33333333-3333-3333-3333-333333333333', dependencyType: 0, lagMinutes: 0 } } },
    { name: 'uteamup_project_dependencies_remove', args: { project_guid: PROJECT_GUID, dependency_guid: RESOURCE_GUID } },
    { name: 'uteamup_project_activity_list', args: { project_guid: PROJECT_GUID, limit: 100 } },
    { name: 'uteamup_project_comments_list', args: { project_guid: PROJECT_GUID } },
    { name: 'uteamup_project_comments_add', args: { project_guid: PROJECT_GUID, model: { text: 'Decision recorded', isDecision: true, mentionedUserGuids: [] } } },
    { name: 'uteamup_project_comments_update', args: { project_guid: PROJECT_GUID, comment_guid: RESOURCE_GUID, model: { text: 'Updated decision', isDecision: true, mentionedUserGuids: [] } } },
    { name: 'uteamup_project_comments_remove', args: { project_guid: PROJECT_GUID, comment_guid: RESOURCE_GUID } },
    { name: 'uteamup_project_baselines_list', args: { project_guid: PROJECT_GUID } },
    { name: 'uteamup_project_baselines_capture', args: { project_guid: PROJECT_GUID, model: { label: 'Approved plan' } } },
    { name: 'uteamup_project_variance_get', args: { project_guid: PROJECT_GUID, baseline_guid: RESOURCE_GUID } },
    { name: 'uteamup_project_change_requests_list', args: { project_guid: PROJECT_GUID } },
    { name: 'uteamup_project_change_requests_create', args: { project_guid: PROJECT_GUID, model: { summary: 'Move finish date', reason: 'Supplier delay', proposedChanges: { endDate: '2026-09-01' } } } },
    { name: 'uteamup_project_change_requests_submit', args: { project_guid: PROJECT_GUID, request_guid: RESOURCE_GUID } },
    { name: 'uteamup_project_change_requests_approve', args: { project_guid: PROJECT_GUID, request_guid: RESOURCE_GUID } },
    { name: 'uteamup_project_change_requests_reject', args: { project_guid: PROJECT_GUID, request_guid: RESOURCE_GUID } },
    { name: 'uteamup_project_change_requests_apply', args: { project_guid: PROJECT_GUID, request_guid: RESOURCE_GUID } },
  ];

  const listTools = tools.filter(({ name }) => name.endsWith('_list'));

  test.each(tools)('$name forwards arguments and returns a success result', async ({ name, args }) => {
    const response = await call(name, args, successReply({ ok: true }));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual({ ok: true });
  });

  test.each(listTools)('$name preserves an empty list', async ({ name, args }) => {
    const response = await call(name, args, successReply([]));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });

  test.each(tools)('$name preserves backend JSON-RPC errors', async ({ name, args }) => {
    const response = await call(name, args, errorReply(-32603, 'Project governance operation failed'));
    expect(response.body.error).toEqual(expect.objectContaining({ code: -32603 }));
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
