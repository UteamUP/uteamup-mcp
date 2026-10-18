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

describe('workorder template prerequisite MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_template_prerequisite';
  const templateGuid = '44444444-4444-4444-8444-444444444444';
  const prerequisiteGuid = '55555555-5555-4555-8555-555555555555';
  const references = [{ guid: prerequisiteGuid, name: 'Buy tires' }];

  const tools = [
    { name: 'UteamupWorkorderTemplatePrerequisiteList', args: { templateGuid } },
    {
      name: 'UteamupWorkorderTemplatePrerequisiteSet',
      args: { templateGuid, model: { prerequisiteTemplateGuids: [prerequisiteGuid] } },
    },
    {
      name: 'UteamupWorkorderTemplateCreateFromTemplate',
      args: { templateGuid, overrides: { createPrerequisites: true } },
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  async function call(toolName, args, data) {
    const response = await callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, args, successReply(data));
    expect(response.status).toBe(200);
    return JSON.parse(response.body.result.content[0].text);
  }

  it('lists and replaces the prerequisite templates', async () => {
    expect(await call(tools[0].name, tools[0].args, references)).toEqual(references);
    expect(await call(tools[1].name, tools[1].args, references)).toEqual(references);
  });

  it('clears the set with an empty list', async () => {
    const result = await call(tools[1].name, { templateGuid, model: { prerequisiteTemplateGuids: [] } }, []);

    expect(result).toEqual([]);
  });

  it('forwards createPrerequisites and returns the created prerequisites', async () => {
    const created = {
      guid: '66666666-6666-4666-8666-666666666666',
      name: 'Change tires',
      createdPrerequisites: [{ workorderGuid: '77777777-7777-4777-8777-777777777777', name: 'Buy tires' }],
    };

    const result = await call(tools[2].name, tools[2].args, created);

    expect(result.createdPrerequisites).toHaveLength(1);
    expect(JSON.stringify(tools[2].args)).toContain('"createPrerequisites":true');
  });

  it('round-trips a loop rejection from the backend', async () => {
    const response = await callMcpTool(
      BASE_URL, ACCESS_TOKEN, tools[1].name, tools[1].args,
      errorReply(-32602, 'These prerequisites would create a loop.'),
    );

    expect(response.body.error.message).toContain('loop');
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
