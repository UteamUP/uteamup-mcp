'use strict';

const nock = require('nock');
const {
  callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('project prerequisite MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_project_prerequisite';
  const projectGuid = '11111111-1111-4111-8111-111111111111';
  const prerequisiteProjectGuid = '22222222-2222-4222-8222-222222222222';
  const dependencyGuid = '33333333-3333-4333-8333-333333333333';
  const item = {
    dependencyGuid,
    projectGuid: prerequisiteProjectGuid,
    name: 'Foundation works',
    projectCode: 'PRJ-7',
    status: 1,
    isRestricted: false,
  };
  const prerequisites = {
    projectGuid,
    waitingOn: [item],
    blocks: [],
    openPrerequisites: 1,
  };

  const tools = [
    { name: 'UteamupProjectPrerequisitesList', args: { projectGuid } },
    { name: 'UteamupProjectPrerequisitesAdd', args: { projectGuid, model: { prerequisiteProjectGuid } } },
    { name: 'UteamupProjectPrerequisitesRemove', args: { projectGuid, dependencyGuid } },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  async function call(toolName, args, data) {
    const response = await callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, args, successReply(data));
    expect(response.status).toBe(200);
    return JSON.parse(response.body.result.content[0].text);
  }

  it('lists the projects a project waits on and the open prerequisite count', async () => {
    const result = await call(tools[0].name, tools[0].args, prerequisites);

    expect(result).toEqual(prerequisites);
    expect(result.openPrerequisites).toBe(1);
  });

  it('preserves a restricted prerequisite without its name or code', async () => {
    const restricted = {
      ...prerequisites,
      waitingOn: [{ ...item, name: 'Restricted project', projectCode: null, isRestricted: true }],
    };

    const result = await call(tools[0].name, tools[0].args, restricted);

    expect(result.waitingOn[0].isRestricted).toBe(true);
    expect(result.waitingOn[0].projectCode).toBeNull();
  });

  it('preserves an empty prerequisite set', async () => {
    const empty = { projectGuid, waitingOn: [], blocks: [], openPrerequisites: 0 };

    expect(await call(tools[0].name, tools[0].args, empty)).toEqual(empty);
  });

  it.each([
    [tools[1], item],
    [tools[2], true],
  ])('$name forwards GUID-only arguments', async (tool, data) => {
    const result = await call(tool.name, tool.args, data);

    expect(result).toEqual(data);
    expect(JSON.stringify(tool.args)).not.toMatch(/"(?:tenantId|tenantGuid|userId|projectId|dependencyId)"/);
  });

  it('round-trips a loop rejection from the backend', async () => {
    const response = await callMcpTool(
      BASE_URL, ACCESS_TOKEN, tools[1].name, tools[1].args,
      errorReply(-32602, 'This link would create a loop.'),
    );

    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toContain('loop');
  });

  it('round-trips a permission denial from the backend', async () => {
    const response = await callMcpTool(
      BASE_URL, ACCESS_TOKEN, tools[1].name, tools[1].args,
      errorReply(-32603, 'Permission denied: Project.ManageDependencies required'),
    );

    expect(response.body.error.message).toContain('Project.ManageDependencies');
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
