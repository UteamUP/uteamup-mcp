'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('UteamupShiftHandoverGenerateSummary MCP tool', () => {
  const baseUrl = 'https://api.test.com';
  const token = 'shift_handover_ai_token';
  const args = {
    handoverGuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    language: 'en',
    summaryType: 'detailed',
  };
  const call = (name, toolArgs, reply) => callMcpTool(baseUrl, token, name, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('returns an editable draft with the credit receipt', async () => {
    const response = await call(
      'UteamupShiftHandoverGenerateSummary',
      args,
      successReply({
        isSuccess: true,
        summary: 'Work done: pump seal replaced.',
        creditsCharged: 5,
        remaining: 15,
      }),
    );
    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.summary).toContain('pump seal');
    expect(result.creditsCharged).toBe(5);
  });

  const tools = [{ name: 'UteamupShiftHandoverGenerateSummary', args }];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
