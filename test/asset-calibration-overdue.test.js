'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Asset calibration MCP GUID contracts', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'asset-calibration-overdue-token';
  const call = (toolName, toolArgs, reply, expectedArgs) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply, expectedArgs);

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

  test('forwards GUID selectors and GUID-only write payloads unchanged', async () => {
    const calibrationGuid = '55555555-5555-4555-8555-555555555555';
    const assetGuid = '66666666-6666-4666-8666-666666666666';
    const args = {
      calibrationGuid,
      model: {
        assetGuid,
        name: 'Annual pressure calibration',
        frequencyType: 'Yearly',
        frequencyValue: 1,
        status: 'Scheduled',
      },
    };

    const response = await call(
      'UteamupAssetcalibrationUpdate',
      args,
      successReply({ guid: calibrationGuid, assetGuid }),
      args,
    );

    const calibration = JSON.parse(response.body.result.content[0].text);
    expect(calibration.guid).toBe(calibrationGuid);
    expect(calibration.assetGuid).toBe(assetGuid);
    expect(args).not.toHaveProperty('id');
    expect(args.model).not.toHaveProperty('assetId');
  });

  test('returns generated workorder GUIDs without integer aliases', async () => {
    const workorderGuid = '77777777-7777-4777-8777-777777777777';
    const response = await call(
      'UteamupAssetcalibrationGenerateWorkorders',
      {},
      successReply({
        success: true,
        workordersGenerated: 1,
        generatedWorkorderGuids: [workorderGuid],
      }),
    );

    const receipt = JSON.parse(response.body.result.content[0].text);
    expect(receipt.generatedWorkorderGuids).toEqual([workorderGuid]);
    expect(receipt).not.toHaveProperty('generatedWorkorderIds');
  });

  const tools = [
    {
      name: 'UteamupAssetcalibrationGetByAsset',
      args: { assetGuid: '11111111-1111-4111-8111-111111111111' },
    },
    {
      name: 'UteamupAssetcalibrationGet',
      args: { calibrationGuid: '22222222-2222-4222-8222-222222222222' },
    },
    { name: 'UteamupAssetcalibrationGetOverdue', args: {} },
    { name: 'UteamupAssetcalibrationGetDueSoon', args: { days: 30 } },
    {
      name: 'UteamupAssetcalibrationCreate',
      args: {
        model: {
          assetGuid: '33333333-3333-4333-8333-333333333333',
          name: 'Annual calibration',
          frequencyType: 'Yearly',
          frequencyValue: 1,
          status: 'Scheduled',
        },
      },
    },
    {
      name: 'UteamupAssetcalibrationUpdate',
      args: {
        calibrationGuid: '44444444-4444-4444-8444-444444444444',
        model: {
          assetGuid: '55555555-5555-4555-8555-555555555555',
          name: 'Updated calibration',
          frequencyType: 'Monthly',
          frequencyValue: 6,
          status: 'Scheduled',
        },
      },
    },
    {
      name: 'UteamupAssetcalibrationDelete',
      args: { calibrationGuid: '66666666-6666-4666-8666-666666666666' },
    },
    { name: 'UteamupAssetcalibrationGenerateWorkorders', args: {} },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
