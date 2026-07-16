'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('AssetCalendarBooking GUID-first MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'asset-calendar-guid-token';
  const assetGuid = '11111111-1111-1111-1111-111111111111';
  const bookingGuid = '22222222-2222-2222-2222-222222222222';
  const sourceGuid = '33333333-3333-3333-3333-333333333333';
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('round-trips GUID-only list arguments and response identity', async () => {
    const response = await call(
      'UteamupAssetCalendarBookingList',
      { assetGuid, from: '2026-07-01T00:00:00Z', to: '2026-08-01T00:00:00Z' },
      successReply([{ externalGuid: bookingGuid, assetExternalGuid: assetGuid }]),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toEqual([{ externalGuid: bookingGuid, assetExternalGuid: assetGuid }]);
    expect(data[0]).not.toHaveProperty('id');
    expect(data[0]).not.toHaveProperty('assetId');
  });

  test('returns an empty list without inventing records', async () => {
    const response = await call(
      'UteamupAssetCalendarBookingList',
      { assetGuid },
      successReply([]),
    );

    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });

  test('round-trips GUID-only create arguments', async () => {
    const model = {
      bookingType: 2,
      sourceEntityExternalGuid: sourceGuid,
      startDateTime: '2026-07-20T08:00:00Z',
      endDateTime: '2026-07-20T10:00:00Z',
      isConfirmed: true,
    };
    const response = await call(
      'UteamupAssetCalendarBookingCreate',
      { assetGuid, model },
      successReply({
        externalGuid: bookingGuid,
        assetExternalGuid: assetGuid,
        sourceEntityExternalGuid: sourceGuid,
      }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.sourceEntityExternalGuid).toBe(sourceGuid);
    expect(model).not.toHaveProperty('assetId');
    expect(model).not.toHaveProperty('sourceEntityId');
  });

  test('preserves backend validation errors', async () => {
    const response = await call(
      'UteamupAssetCalendarBookingCreate',
      { assetGuid, model: { bookingType: 2 } },
      errorReply(-32602, 'A source entity GUID is required'),
    );

    expect(response.body.error.code).toBe(-32602);
    expect(response.body.error.message).toContain('source entity GUID');
  });

  const tools = [
    { name: 'UteamupAssetCalendarBookingList', args: { assetGuid } },
    {
      name: 'UteamupAssetCalendarBookingGetConflicts',
      args: {
        assetGuid,
        start: '2026-07-20T08:00:00Z',
        end: '2026-07-20T10:00:00Z',
        excludeBookingGuid: bookingGuid,
      },
    },
    {
      name: 'UteamupAssetCalendarBookingCreate',
      args: {
        assetGuid,
        model: {
          bookingType: 3,
          startDateTime: '2026-07-20T08:00:00Z',
          endDateTime: '2026-07-20T10:00:00Z',
          isConfirmed: true,
        },
      },
    },
    { name: 'UteamupAssetCalendarBookingDelete', args: { assetGuid, bookingGuid } },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});

