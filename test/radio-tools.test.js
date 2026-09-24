'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

const baseUrl = 'https://api.test.com';
const recordingGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tools = [
  { name: 'UteamupRadioEnvironmentGet', args: {} },
  { name: 'UteamupRadioPolicyUpdate', args: { model: { companyMode: 'SeparateChannel', recordTransmissions: true, retentionDays: 30 } } },
  { name: 'UteamupRadioHistoryChannelsList', args: {} },
  { name: 'UteamupRadioRecordingsList', args: { channelGuid: recordingGuid, skip: 10, take: 25 } },
  { name: 'UteamupRadioRecordingGet', args: { recordingGuid } },
  { name: 'UteamupRadioPlaybackGet', args: { recordingGuid } },
];
const call = (name, args, reply) => callMcpTool(baseUrl, 'synthetic-token', name, args, reply);

describe('Radio administration and authorized history', () => {
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  test.each(tools)('$name preserves response and GUID arguments', async ({ name, args }) => {
    const data = { recordingGuid, status: 'Available', visibility: 'Private', transcript: [] };
    const response = await call(name, args, successReply(data));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(data);
    expect(Object.keys(args)).not.toContain('tenantId');
    expect(Object.keys(args)).not.toContain('userId');
  });
  test('empty authorized history remains empty', async () => {
    const result = await call('UteamupRadioRecordingsList', {}, successReply([]));
    expect(JSON.parse(result.body.result.content[0].text)).toEqual([]);
  });
  test('private recording denial is never converted to a recording', async () => {
    const result = await call('UteamupRadioRecordingGet', { recordingGuid }, errorReply(-32603, 'RADIO_RECORDING_NOT_FOUND'));
    expect(result.body.error.message).toBe('RADIO_RECORDING_NOT_FOUND');
  });
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
