'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

const baseUrl = 'https://api.test.com';
const recordingGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tools = [
  { name: 'UteamupRadioValidate', args: {} },
  { name: 'UteamupRadioAdministrationValidate', args: {} },
  { name: 'UteamupRadioPilotStop', args: { model: { grantGuid: recordingGuid, reason: 'Customer no longer needs radio' } } },
  { name: 'UteamupRadioAdministrationGet', args: {} },
  { name: 'UteamupRadioComplimentaryGrant', args: { model: { requestGuid: recordingGuid, expiresAt: null, reason: 'Approved pilot' } } },
  { name: 'UteamupRadioComplimentaryRevoke', args: { model: { grantGuid: recordingGuid, reason: 'Pilot complete' } } },
  { name: 'UteamupRadioTransmissionTranscriptGet', args: { channelGuid: recordingGuid, transmissionGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } },
  { name: 'UteamupRadioTransmissionsList', args: { channelGuid: recordingGuid, skip: 0, take: 25 } },
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
  test.each(['UteamupRadioValidate', 'UteamupRadioAdministrationValidate'])('%s preserves failed and unverified checks', async name => {
    const data = {
      tenantGuid: recordingGuid,
      environmentGuid: null,
      checkedAt: '2026-09-27T16:00:00Z',
      status: 'Failed',
      services: [
        { service: 'Control', status: 'Failed', detailCode: 'RADIO_RUNTIME_UNREACHABLE' },
        { service: 'TurnConnectivity', status: 'NotChecked', detailCode: 'RADIO_DEVICE_TEST_REQUIRED' },
      ],
    };
    const response = await call(name, {}, successReply(data));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(data);
  });
  test('tenant validation preserves access denial', async () => {
    const result = await call('UteamupRadioValidate', {}, errorReply(-32603, 'RADIO_ACCESS_DENIED'));
    expect(result.body.error.message).toBe('RADIO_ACCESS_DENIED');
  });
  test('validation without returned checks remains unverified', async () => {
    const data = { tenantGuid: recordingGuid, environmentGuid: null, checkedAt: '2026-09-27T16:00:00Z', status: 'NotChecked', services: [] };
    const result = await call('UteamupRadioValidate', {}, successReply(data));
    expect(JSON.parse(result.body.result.content[0].text)).toEqual(data);
  });
  test('customer decommissioning preserves membership denial', async () => {
    const result = await call('UteamupRadioPilotStop', { model: { grantGuid: recordingGuid, reason: 'Stop pilot' } }, errorReply(-32603, 'RADIO_ACCESS_DENIED'));
    expect(result.body.error.message).toBe('RADIO_ACCESS_DENIED');
  });
  test.each(tools.filter(tool => /Administration|Complimentary/.test(tool.name)))('$name preserves platform-admin denial', async ({ name, args }) => {
    const result = await call(name, args, errorReply(-32603, 'RADIO_ADMIN_REQUIRED'));
    expect(result.body.error.message).toBe('RADIO_ADMIN_REQUIRED');
  });
  test('private recording denial is never converted to a recording', async () => {
    const result = await call('UteamupRadioRecordingGet', { recordingGuid }, errorReply(-32603, 'RADIO_RECORDING_NOT_FOUND'));
    expect(result.body.error.message).toBe('RADIO_RECORDING_NOT_FOUND');
  });
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
