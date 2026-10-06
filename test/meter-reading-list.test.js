'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

// UteamupMeterreadingList / UteamupMeterreadingGet: tenant-wide meter readings, newest first.
// There is deliberately no person filter: who recorded a reading and where are restricted
// fields the backend withholds per caller.
describe('Meter reading list and get MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'meter-reading-list-token';
  const LIST = 'UteamupMeterreadingList';
  const GET = 'UteamupMeterreadingGet';
  const ASSET_GUID = '3e1cd135-07d1-46ff-8f5f-549da5390e78';
  const ATTRIBUTE_GUID = 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d';
  const READING_GUID = 'b2c3d4e5-f6a7-4b5c-8d7e-9f0a1b2c3d4e';
  const call = (toolName, toolArgs, reply, expectedArgs) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply, expectedArgs);

  const reading = {
    externalGuid: READING_GUID,
    assetGuid: ASSET_GUID,
    assetName: 'P-101',
    locationGuid: 'c3d4e5f6-a7b8-4c5d-9e0f-1a2b3c4d5e6f',
    locationName: 'Pump house',
    attributeDefinitionGuid: ATTRIBUTE_GUID,
    attributeName: 'Run hours',
    unit: 'h',
    readingValue: 1204.5,
    readingTimestamp: '2026-10-06T08:30:00Z',
    source: 'manual',
    quality: 'normal',
    recordedByUserName: null,
    latitude: null,
    longitude: null,
    withheldFields: ['recordedBy', 'location'],
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  describe(LIST, () => {
    test('returns one page with asset and location names', async () => {
      const response = await call(LIST, {}, successReply({
        totalCount: 1, page: 1, pageSize: 25, items: [reading],
      }));

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.totalCount).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].assetName).toBe('P-101');
      expect(result.items[0].locationName).toBe('Pump house');
      expect(result.items[0].withheldFields).toEqual(['recordedBy', 'location']);
    });

    test('an empty period comes back as an empty page', async () => {
      const response = await call(LIST, { from: '2026-10-06T00:00:00Z' }, successReply({
        totalCount: 0, page: 1, pageSize: 25, items: [],
      }));

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.totalCount).toBe(0);
      expect(result.items).toEqual([]);
    });

    test('forwards every filter verbatim', async () => {
      const args = {
        page: 2,
        pageSize: 50,
        from: '2026-10-01T00:00:00Z',
        to: '2026-10-06T23:59:59Z',
        assetGuid: ASSET_GUID,
        attributeDefinitionGuid: ATTRIBUTE_GUID,
        source: 'IoT',
        quality: 'Estimated',
        search: 'WO-1042',
      };
      const response = await call(LIST, args, successReply({
        totalCount: 0, page: 2, pageSize: 50, items: [],
      }), args);

      expect(response.body.result).toBeDefined();
    });

    test('from after to is rejected with the backend message', async () => {
      const response = await call(LIST, {
        from: '2026-10-06T00:00:00Z', to: '2026-10-01T00:00:00Z',
      }, errorReply(-32602, 'From must be on or before To.'));

      expect(response.body.error.message).toContain('From must be on or before To');
    });

    test('a caller without MeterReading.Read gets the permission error', async () => {
      const response = await call(LIST, {}, errorReply(-32603,
        'Requires MeterReading.Read permission.'));

      expect(response.body.error.message).toContain('MeterReading.Read');
    });
  });

  describe(GET, () => {
    test('returns one reading by its Guid', async () => {
      const response = await call(GET, { readingGuid: READING_GUID }, successReply(reading),
        { readingGuid: READING_GUID });

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.externalGuid).toBe(READING_GUID);
      expect(result.assetName).toBe('P-101');
      expect(result).not.toHaveProperty('id');
    });

    test('a reading outside the tenant is reported as not found', async () => {
      const response = await call(GET, { readingGuid: READING_GUID }, errorReply(-32603,
        'Meter reading not found.'));

      expect(response.body.error.message).toContain('not found');
    });
  });

  const tools = [
    { name: LIST, args: { page: 1, pageSize: 25 } },
    { name: GET, args: { readingGuid: READING_GUID } },
  ];
  describeJsonRpcCompliance((toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply), tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
