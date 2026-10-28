'use strict';
const nock = require('nock');
const { callMcpTool } = require('./helpers/mcp-test-helpers');
describe('Push snooze external actor boundary', () => {
  beforeAll(() => nock.disableNetConnect());
  afterAll(() => nock.enableNetConnect());
  afterEach(() => nock.cleanAll());
  test('preserves refusal instead of claiming an API key changed its owner preferences', async () => {
    const refusal = { isError: true, content: [{ type: 'text', text: 'An interactive human session is required for push snooze.' }] };
    const response = await callMcpTool('https://api.uteamup.com', 'external', 'UteamupUserPushSnoozeSet',
      { durationMinutes: 60 },
      { status: 200, body: { jsonrpc: '2.0', id: 1, result: refusal } },
      { durationMinutes: 60 });
    expect(response.body.result.isError).toBe(true);
    expect(nock.isDone()).toBe(true);
  });
});
