'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

// UteamupMeterreadingMyViewLog: who viewed the signed-in person's restricted reading data.
// Self-service: the person comes from the Bearer token, never from an argument.
describe('Meter reading view log MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'meter-view-log-token';
  const TOOL = 'UteamupMeterreadingMyViewLog';
  const call = (toolArgs, reply, expectedArgs) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, TOOL, toolArgs, reply, expectedArgs);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('returns who viewed which data, newest first', async () => {
    const response = await call({}, successReply([
      {
        accessedAt: '2026-10-06T09:14:00Z',
        viewerName: 'Mani Manager',
        assetGuid: '3e1cd135-07d1-46ff-8f5f-549da5390e78',
        assetName: 'P-101',
        fields: ['recordedBy', 'location'],
        channel: 'Web',
        scope: 'History',
      },
    ]));

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result).toHaveLength(1);
    expect(result[0].viewerName).toBe('Mani Manager');
    expect(result[0].fields).toEqual(['recordedBy', 'location']);
    expect(result[0]).not.toHaveProperty('accessedByUserId');
  });

  test('an empty log comes back as an empty list', async () => {
    const response = await call({}, successReply([]));

    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });

  test('forwards take verbatim', async () => {
    const response = await call({ take: 25 }, successReply([]), { take: 25 });

    expect(response.body.result).toBeDefined();
  });

  test('an API key is refused with the backend message', async () => {
    const response = await call({}, errorReply(-32603,
      'This log belongs to the person themselves; sign in as that person.'));

    expect(response.body.error.message).toContain('sign in as that person');
  });

  const tools = [{ name: TOOL, args: { take: 50 } }];
  describeJsonRpcCompliance((toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply), tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
