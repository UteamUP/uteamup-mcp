'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Agent skill MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'agent-skill-token';
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('lists skills with name, description, access and files', async () => {
    const response = await call(
      'UteamupAgentSkillList',
      {},
      successReply([
        {
          name: 'uteamup-cmms-lookup',
          description: 'Finds UteamUP assets and work orders. Use when the user asks about their CMMS data.',
          readOnly: true,
          files: ['SKILL.md'],
        },
      ]),
    );

    const skills = JSON.parse(response.body.result.content[0].text);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('uteamup-cmms-lookup');
    expect(skills[0].readOnly).toBe(true);
    expect(skills[0].files).toEqual(['SKILL.md']);
  });

  test('lists no skills for accounts without CMMS skills', async () => {
    const response = await call('UteamupAgentSkillList', {}, successReply([]));

    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });

  test('forwards the skill name and reference file verbatim', async () => {
    const args = { name: 'uteamup-preventive-maintenance', file: 'references/intervals.md' };
    // The mock only matches when the backend receives exactly these arguments.
    const response = await callMcpTool(
      BASE_URL, ACCESS_TOKEN, 'UteamupAgentSkillGet', args, successReply('# Intervals'), args,
    );

    expect(response.body.result.content[0].text).toContain('Intervals');
  });

  test('takes no tenant or user arguments; identity comes from the token', async () => {
    const response = await callMcpTool(
      BASE_URL, ACCESS_TOKEN, 'UteamupAgentSkillList', {}, successReply([]), {},
    );

    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });

  test('preserves backend errors', async () => {
    const response = await call(
      'UteamupAgentSkillGet',
      { name: 'uteamup-cmms-lookup' },
      errorReply(-32602, 'Invalid params'),
    );

    expect(response.body.error.code).toBe(-32602);
  });

  const tools = [
    { name: 'UteamupAgentSkillList', args: {} },
    { name: 'UteamupAgentSkillGet', args: { name: 'uteamup-cmms-lookup' } },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
