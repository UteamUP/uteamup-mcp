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

describe('journal field-note MCP contract', () => {
  const baseUrl = 'https://api.test.com';
  const accessToken = 'test_access_token_journal_field_note';
  const workorderGuid = '11111111-1111-4111-8111-111111111111';
  const assignmentGuid = '22222222-2222-4222-8222-222222222222';
  const journalGuid = '33333333-3333-4333-8333-333333333333';
  const args = {
    model: {
      title: 'Pump voice note',
      content: 'Seal is leaking',
      journalDate: '2026-07-16T10:00:00Z',
      priority: 3,
      entryType: 'voiceNote',
      workorderGuid,
      assignmentGuid,
      transcriptOriginalText: 'seal is leaking',
      transcriptLanguage: 'en',
      transcriptConfidence: 0.86,
      transcriptEdited: true,
      transcriptEnhanced: false,
    },
  };
  const result = {
    guid: journalGuid,
    ...args.model,
  };

  const call = (name, toolArgs, reply) => callMcpTool(
    baseUrl,
    accessToken,
    name,
    toolArgs,
    reply,
  );

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('forwards GUID schedule context and transcript evidence without integer IDs', async () => {
    const response = await callMcpTool(
      baseUrl,
      accessToken,
      'UteamupJournalCreate',
      args,
      successReply(result),
      args,
    );

    expect(response.status).toBe(200);
    const payload = JSON.parse(response.body.result.content[0].text);
    expect(payload.guid).toBe(journalGuid);
    expect(payload.workorderGuid).toBe(workorderGuid);
    expect(payload.assignmentGuid).toBe(assignmentGuid);
    expect(payload.transcriptConfidence).toBe(0.86);
    expect(JSON.stringify(args.model)).not.toMatch(/"(?:workorderId|assignmentId)"/);
  });

  test('round-trips backend validation errors', async () => {
    const response = await call(
      'UteamupJournalCreate',
      args,
      errorReply(-32602, 'Title is required'),
    );

    expect(response.body.error).toMatchObject({
      code: -32602,
      message: 'Title is required',
    });
  });

  const tools = [{ name: 'UteamupJournalCreate', args }];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
