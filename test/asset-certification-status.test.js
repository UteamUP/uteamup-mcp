'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Asset certification status MCP reads', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'asset-certification-status-token';
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('round-trips expired certification GUID evidence', async () => {
    const response = await call(
      'UteamupAssetcertificationGetExpired',
      {},
      successReply([{
        guid: '11111111-1111-1111-1111-111111111111',
        assetGuid: '22222222-2222-2222-2222-222222222222',
        name: 'Annual lifting inspection',
        isOverdue: true,
      }]),
    );

    const [certification] = JSON.parse(response.body.result.content[0].text);
    expect(certification.guid).toBe('11111111-1111-1111-1111-111111111111');
    expect(certification.assetGuid).toBe('22222222-2222-2222-2222-222222222222');
  });

  test('create payload accepts CE type and retain-until fields', async () => {
    const response = await call(
      'UteamupAssetcertificationCreate',
      {
        model: {
          assetGuid: '55555555-5555-5555-5555-555555555555',
          certificationType: 'CeMarking',
          name: 'CE motor',
          frequencyType: 'Yearly',
          frequencyValue: 1,
          status: 'Active',
          aiSafetyComponent: true,
          retainUntil: '2036-01-01T00:00:00Z',
        },
      },
      successReply({
        guid: '66666666-6666-6666-6666-666666666666',
        assetGuid: '55555555-5555-5555-5555-555555555555',
        certificationType: 'CeMarking',
        aiSafetyComponent: true,
        retainUntil: '2036-01-01T00:00:00Z',
      }),
    );

    const created = JSON.parse(response.body.result.content[0].text);
    expect(created.certificationType).toBe('CeMarking');
    expect(created.aiSafetyComponent).toBe(true);
    expect(created.retainUntil).toBe('2036-01-01T00:00:00Z');
  });

  test('round-trips a bounded expiring-certification window', async () => {
    const response = await call(
      'UteamupAssetcertificationGetExpiringSoon',
      { days: 60 },
      successReply([{
        guid: '33333333-3333-3333-3333-333333333333',
        assetGuid: '44444444-4444-4444-4444-444444444444',
        daysUntilDue: 20,
      }]),
    );

    const [certification] = JSON.parse(response.body.result.content[0].text);
    expect(certification.guid).toBe('33333333-3333-3333-3333-333333333333');
    expect(certification.daysUntilDue).toBe(20);
  });

  const tools = [
    { name: 'UteamupAssetcertificationGetExpired', args: {} },
    { name: 'UteamupAssetcertificationGetExpiringSoon', args: { days: 30 } },
    {
      name: 'UteamupAssetcertificationCreate',
      args: {
        model: {
          assetGuid: '55555555-5555-5555-5555-555555555555',
          certificationType: 'CeMarking',
          name: 'CE motor',
          frequencyType: 'Yearly',
          frequencyValue: 1,
          status: 'Active',
        },
      },
    },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
