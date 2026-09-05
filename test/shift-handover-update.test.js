'use strict';

const nock = require('nock');
const { callMcpTool, sendRawRequest, successReply } = require('./helpers/mcp-test-helpers');

describe('Versioned shift handover draft updates', () => {
  const baseUrl = 'https://api.test.com';
  const args = {
    handoverGuid: '11111111-1111-4111-8111-111111111111',
    concurrencyToken: 'reviewed-draft-token',
    idempotencyKey: '22222222-2222-4222-8222-222222222222',
    incomingOperatorGuid: '33333333-3333-4333-8333-333333333333',
    overallAssessment: 'minorIssues',
    summary: '',
  };
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('forwards public worker identity and retry evidence without changing an explicit empty summary', async () => {
    let captured;
    nock(baseUrl).post('/mcp', body => {
      captured = body.params.arguments;
      return body.params.name === 'UteamupShiftHandoverUpdate';
    }).reply(200, JSON.stringify(successReply({ guid: args.handoverGuid }).body), {
      'Content-Type': 'application/json',
    });
    await sendRawRequest(baseUrl, 'UteamupShiftHandoverUpdate', args);
    expect(captured).toEqual(args);
    expect(captured).not.toHaveProperty('id');
    expect(captured).not.toHaveProperty('incomingOperatorId');
    expect(captured).not.toHaveProperty('incomingOperatorName');
  });

  test('preserves the saved revision and replay receipt in the response', async () => {
    const record = { guid: args.handoverGuid, concurrencyToken: 'saved-token',
      mutationReceiptGuid: '44444444-4444-4444-8444-444444444444', idempotencyReplay: true };
    const response = await callMcpTool(baseUrl, 'test-token', 'UteamupShiftHandoverUpdate', args, successReply(record));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(record);
  });
});
