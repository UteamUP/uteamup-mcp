'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('daily briefing MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'daily-briefing-token';
  const briefingGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const readTool = {
    name: 'UteamupBriefingDailyRead',
    args: { briefingGuid },
  };
  const confirmTool = {
    name: 'UteamupBriefingDecisionPropose',
    args: { briefingGuid, optionKey: 'createWorkorder' },
  };
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('reads a GUID-first briefing without integer ids', async () => {
    const response = await call(
      readTool.name,
      readTool.args,
      successReply({
        briefing: {
          guid: briefingGuid,
          script: 'Three open work orders.',
          decisionStatus: 'Pending',
        },
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.briefing.guid).toBe(briefingGuid);
    expect(result.briefing).not.toHaveProperty('id');
  });

  test('confirm preserves WorkOrder.Create denials', async () => {
    const response = await call(
      confirmTool.name,
      confirmTool.args,
      errorReply(-32000, 'Permission denied: WorkOrder.Create required.'),
    );

    expect(response.body.error.message).toMatch(/WorkOrder\.Create/);
  });

  const tools = [readTool, confirmTool];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
