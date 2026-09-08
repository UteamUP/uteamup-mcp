'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

const BASE_URL = 'https://api.test.com';
const GUID = '11111111-1111-4111-8111-111111111111';
const VERSION = '2026-09-08T10:00:00Z';
const handover = { expectedUpdatedAtUtc: VERSION, inspectionGuid: GUID, observedAtUtc: VERSION, meterBasis: 'engineHours', meterValue: 1450.5, odometerKm: 0 };
const tools = [
  { name: 'UteamupAssetrentalCreateOrUpdate', args: { assetGuid: GUID, model: { assetGuid: GUID, dailyRate: 125, currencyGuid: GUID } } },
  { name: 'UteamupAssetrentalStart', args: { assetGuid: GUID, model: { requestGuid: GUID, customerGuid: GUID, rentalStartDate: VERSION, expectedEndDate: '2026-09-10T10:00:00Z', rateType: 'Daily' } } },
  { name: 'UteamupAssetrentalExtend', args: { rentalGuid: GUID, model: { expectedUpdatedAtUtc: VERSION, expectedEndDate: '2026-09-12T10:00:00Z', reason: 'Tour extended' } } },
  { name: 'UteamupAssetrentalCancel', args: { rentalGuid: GUID, model: { expectedUpdatedAtUtc: VERSION, reason: 'Customer cancelled' } } },
  { name: 'UteamupAssetrentalCheckout', args: { rentalGuid: GUID, model: handover } },
  { name: 'UteamupAssetrentalEnd', args: { rentalGuid: GUID, model: { ...handover, meterValue: 1465, requiresCleaning: true } } },
  { name: 'UteamupAssetrentalReady', args: { assetGuid: GUID, model: handover } },
  { name: 'UteamupAssetreadinessCreateHold', args: { assetGuid: GUID, model: { requestGuid: GUID, holdType: 'Cleaning', reason: 'Clean cabin' } } },
  { name: 'UteamupAssetreadinessReleaseHold', args: { holdGuid: GUID, model: { expectedUpdatedAtUtc: VERSION, releaseNotes: 'Cleaning verified' } } },
  { name: 'UteamupAssetreadinessCreateDamage', args: { assetGuid: GUID, model: { requestGuid: GUID, description: 'Door dent', discoveredAtUtc: VERSION, rentalGuid: GUID, photoUrls: ['https://evidence.example.test/dent.jpg'] } } },
  { name: 'UteamupAssetreadinessResolveDamage', args: { damageGuid: GUID, model: { expectedUpdatedAtUtc: VERSION, resolutionNotes: 'Repair inspected', repairWorkorderGuid: GUID } } },
];

describe('GUID rental lifecycle and readiness MCP contract', () => {
  const call = (name, args, reply) => callMcpTool(BASE_URL, 'rental-test-token', name, args, reply, args);
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test.each(tools)('$name forwards exact GUID and evidence arguments', async ({ name, args }) => {
    const result = await call(name, args, successReply({ externalGuid: GUID, assetGuid: GUID, checkOutMeterBasis: 'engineHours', checkOutMeterValue: 1450.5 }));
    expect(JSON.parse(result.body.result.content[0].text)).toMatchObject({ externalGuid: GUID, checkOutMeterBasis: 'engineHours', checkOutMeterValue: 1450.5 });
    expect(args).not.toHaveProperty('tenantId');
    expect(args).not.toHaveProperty('executionActorGuid');
  });
  test.each(tools)('$name preserves a canonical conflict', async ({ name, args }) => {
    const result = await call(name, args, errorReply(-32000, 'Rental evidence changed; refresh before retrying.'));
    expect(result.body.error.message).toContain('refresh');
  });
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
