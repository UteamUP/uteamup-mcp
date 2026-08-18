'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('team mood MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'team-mood-token';
  const teamGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const readTool = {
    name: 'UteamupTeamMoodRead',
    args: { teamGuid },
  };
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('reads anonymous aggregates without identity or check-in dumps', async () => {
    const response = await call(
      readTool.name,
      readTool.args,
      successReply({
        enabled: true,
        teamGuid,
        teamName: 'Nights',
        today: {
          teamGuid,
          sampleSize: 8,
          score10: 7.5,
          isPublished: true,
          topics: [{ topicKey: 'tooling', count: 3 }],
        },
        trend: [],
        topics: [{ topicKey: 'tooling', count: 3 }],
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.teamGuid).toBe(teamGuid);
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('checkins');
    expect(result).not.toHaveProperty('userId');
    expect(JSON.stringify(result)).not.toMatch(/alice|anonymousKey|email/i);
  });

  test('preserves TeamMood.ViewAggregates denials', async () => {
    const response = await call(
      readTool.name,
      readTool.args,
      errorReply(-32000, 'Permission denied: TeamMood.ViewAggregates required.'),
    );

    expect(response.body.error.message).toMatch(/TeamMood\.ViewAggregates/);
  });

  const tools = [readTool];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
