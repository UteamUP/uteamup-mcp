'use strict';

const nock = require('nock');
const {
  callMcpTool: callMcpToolRequest,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Asset state MCP contracts', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_asset_state_token';
  const assetGuid = '55555555-5555-5555-5555-555555555555';
  const workorderGuid = '66666666-6666-6666-6666-666666666666';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    callMcpToolRequest(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  test('round-trips both axes and the consequence flags on each option', async () => {
    const response = await call(
      'UteamupAssetStateGet',
      { assetGuid },
      successReply({
        assetGuid,
        operationalState: 'online',
        currentLifecycleStage: 'operational',
        allowedNextStates: [
          { state: 'offline', countsAsDowntime: true, blocksNewWork: false, flagsForReplacement: false },
          { state: 'degraded', countsAsDowntime: false, blocksNewWork: false, flagsForReplacement: true },
        ],
        allowedNextStages: [
          {
            stage: 'decommissioned',
            requiresApproval: true,
            forcesOperationalState: 'offline',
            blocksNewWork: true,
            stopsLifespanClock: true,
          },
        ],
      }),
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.assetGuid).toBe(assetGuid);
    expect(data).not.toHaveProperty('assetId');

    // The options are what the client renders as "what moving here does". An option that
    // arrives as a bare name tells the user nothing, so every one must carry its flags.
    for (const option of data.allowedNextStates) {
      expect(option).toHaveProperty('state');
      expect(option).toHaveProperty('countsAsDowntime');
      expect(option).toHaveProperty('blocksNewWork');
    }
    const decommission = data.allowedNextStages[0];
    expect(decommission.requiresApproval).toBe(true);
    expect(decommission.blocksNewWork).toBe(true);
    expect(decommission.stopsLifespanClock).toBe(true);
  });

  test('carries the reason and the originating work order into the change', async () => {
    const response = await call(
      'UteamupAssetStateSetOperational',
      {
        assetGuid,
        model: { toState: 'UnderMaintenance', reason: 'Bearing replacement', workorderGuid },
      },
      successReply({
        assetGuid,
        operationalState: 'underMaintenance',
        operationalStateReason: 'Bearing replacement',
      }),
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.operationalState).toBe('underMaintenance');
    expect(data.operationalStateReason).toBe('Bearing replacement');
    expect(data).not.toHaveProperty('assetId');
  });

  test('returns the interval log with exactly one open interval', async () => {
    const response = await call(
      'UteamupAssetStateHistory',
      { assetGuid },
      successReply([
        { assetGuid, fromState: 'online', toState: 'offline', endedAt: null, countsAsDowntime: true },
        {
          assetGuid,
          fromState: null,
          toState: 'online',
          endedAt: '2026-09-01T00:00:00Z',
          durationMinutes: 1440,
          countsAsDowntime: false,
        },
      ]),
    );

    const rows = JSON.parse(response.body.result.content[0].text);
    // Availability is a filter plus a SUM over closed intervals, so a second open row
    // would double-count the present.
    expect(rows.filter((row) => row.endedAt === null)).toHaveLength(1);
    expect(rows[1].durationMinutes).toBe(1440);
  });

  test('reports availability over the requested window', async () => {
    const response = await call(
      'UteamupAssetStateAvailability',
      { assetGuid, from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
      successReply({
        assetGuid,
        uptimeMinutes: 43_200,
        downtimeMinutes: 1_440,
        availabilityPercent: 96.77,
      }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.downtimeMinutes).toBe(1440);
    expect(data.availabilityPercent).toBeCloseTo(96.77, 2);
  });

  test('preserves the rejection when the lifecycle stage forbids the target state', async () => {
    const response = await call(
      'UteamupAssetStateSetOperational',
      { assetGuid, model: { toState: 'Online' } },
      errorReply(-32602, 'Cannot move a decommissioned asset to Online'),
    );

    expect(response.body.error.code).toBe(-32602);
    expect(response.body.error.message).toContain('decommissioned');
  });

  const tools = [
    { name: 'UteamupAssetStateGet', args: { assetGuid } },
    { name: 'UteamupAssetStateHistory', args: { assetGuid } },
    {
      name: 'UteamupAssetStateAvailability',
      args: { assetGuid, from: '2026-08-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
    },
    {
      name: 'UteamupAssetStateSetOperational',
      args: { assetGuid, model: { toState: 'Offline' } },
    },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
