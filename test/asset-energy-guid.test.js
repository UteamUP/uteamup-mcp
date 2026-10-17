'use strict';

const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');

const BASE_URL = 'https://api.test.com';
const assetGuid = '11111111-1111-4111-8111-111111111111';
const recordGuid = '22222222-2222-4222-8222-222222222222';
const routeGuid = '33333333-3333-4333-8333-333333333333';
const record = { guid: recordGuid, externalGuid: recordGuid, assetGuid,
  operationalRouteExecutionGuid: routeGuid, source: 'Manual', fuelConsumedLitres: 12 };

describe('Existing asset energy tools support GUID arguments and GUID-only record JSON', () => {
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test.each([
    ['UteamupAssetEnergyRecordList', { assetGuid }, [record]],
    ['UteamupAssetEnergyRecordGet', { recordGuid }, record],
    ['UteamupAssetEnergyRecordCreate', { assetGuid,
      model: { source: 'Manual', fuelConsumedLitres: 12, operationalRouteExecutionGuid: routeGuid } }, record],
    ['UteamupAssetEnergyRecordUpdate', { recordGuid,
      model: { source: 'Manual', fuelConsumedLitres: 12 } }, record],
    ['UteamupAssetEnergyRecordDelete', { recordGuid }, true],
    ['UteamupAssetEnergyRecordGetSummary', { assetGuid }, { totalFuelLitres: 12, recordCount: 1 }],
  ])('%s preserves preferred public identities through the generic proxy', async (tool, args, result) => {
    const response = await callMcpTool(BASE_URL, 'energy_guid_test_token', tool, args, successReply(result));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(result);
    for (const row of Array.isArray(result) ? result : typeof result === 'object' ? [result] : []) {
      expect(row).not.toHaveProperty('id');
      expect(row).not.toHaveProperty('assetId');
      expect(row).not.toHaveProperty('operationalRouteExecutionId');
    }
  });
});
