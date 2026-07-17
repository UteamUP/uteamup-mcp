'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Overdue asset calibration MCP read', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'asset-calibration-overdue-token';
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('round-trips tenant overdue-calibration evidence without identifier arguments', async () => {
    const response = await call(
      'UteamupAssetcalibrationGetOverdue',
      {},
      successReply([{
        guid: '11111111-1111-1111-1111-111111111111',
        assetGuid: '22222222-2222-2222-2222-222222222222',
        assetName: 'Pressure transmitter PT-4',
        name: 'Annual pressure calibration',
        nextCalibrationDueDate: '2026-07-14T00:00:00Z',
        status: 'Scheduled',
        isOverdue: true,
      }]),
    );

    const [calibration] = JSON.parse(response.body.result.content[0].text);
    expect(calibration.guid).toBe('11111111-1111-1111-1111-111111111111');
    expect(calibration.assetGuid).toBe('22222222-2222-2222-2222-222222222222');
    expect(calibration.isOverdue).toBe(true);
  });

  test('round-trips a bounded due-soon planning window', async () => {
    const response = await call(
      'UteamupAssetcalibrationGetDueSoon',
      { days: 45 },
      successReply([{
        guid: '33333333-3333-3333-3333-333333333333',
        assetGuid: '44444444-4444-4444-4444-444444444444',
        name: 'Quarterly flow calibration',
        daysUntilDue: 12,
      }]),
    );

    const [calibration] = JSON.parse(response.body.result.content[0].text);
    expect(calibration.guid).toBe('33333333-3333-3333-3333-333333333333');
    expect(calibration.daysUntilDue).toBe(12);
  });

  const tools = [
    { name: 'UteamupAssetcalibrationGetOverdue', args: {} },
    { name: 'UteamupAssetcalibrationGetDueSoon', args: { days: 30 } },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
