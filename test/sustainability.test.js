'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Sustainability MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'sustainability-token';
  const readingGuid = '6a1c3e2b-7d4f-4c8a-9b1e-2f3a4b5c6d7e';
  const meterGuid = '11111111-1111-4111-8111-111111111111';
  const locationGuid = '22222222-2222-4222-8222-222222222222';
  const goalGuid = '33333333-3333-4333-8333-333333333333';
  const call = (toolName, toolArgs, reply, expectedArgs) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply, expectedArgs);
  const page = (items) => ({ items, page: 1, pageSize: 25, totalItems: items.length, totalPages: items.length ? 1 : 0 });

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('lists energy readings for a meter with GUIDs only', async () => {
    const args = { utilityMeterGuid: meterGuid, page: 1, pageSize: 25 };
    const reading = { readingGuid, utilityMeterGuid: meterGuid, readingValue: 1520.5, readingType: 'Manual' };
    const response = await call(
      'uteamup_sustainability_energy_reading_list', args, successReply(page([reading])), args,
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.items).toEqual([reading]);
    expect(result.items[0]).not.toHaveProperty('id');
    expect(result.items[0]).not.toHaveProperty('utilityMeterId');
  });

  test('returns an empty page when there are no water readings', async () => {
    const args = { page: 1, pageSize: 25 };
    const response = await call('uteamup_sustainability_water_reading_list', args, successReply(page([])), args);

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.items).toEqual([]);
    expect(result.totalItems).toBe(0);
  });

  test('reads a goal with its progress', async () => {
    const goal = { goalGuid, name: 'Cut energy 10%', targetValue: 90, currentValue: 95, progressPercentage: 50, status: 'OnTrack' };
    const response = await call(
      'uteamup_sustainability_goal_get', { goalGuid }, successReply(goal), { goalGuid },
    );

    expect(JSON.parse(response.body.result.content[0].text)).toEqual(goal);
  });

  test('forwards a water reading create verbatim, without tenant or user arguments', async () => {
    const args = { locationGuid, readingDate: '2026-11-01T00:00:00Z', consumption: 42.5, waterSource: 'Municipal' };
    const response = await call(
      'uteamup_sustainability_water_reading_create', args, successReply({ readingGuid, locationGuid, consumption: 42.5 }), args,
    );

    expect(JSON.parse(response.body.result.content[0].text).readingGuid).toBe(readingGuid);
    expect(args).not.toHaveProperty('tenantId');
    expect(args).not.toHaveProperty('userId');
  });

  test('forwards a partial carbon emission update', async () => {
    const args = { emissionGuid: readingGuid, notes: 'Corrected invoice' };
    const response = await call(
      'uteamup_sustainability_carbon_emission_update', args, successReply({ emissionGuid: readingGuid, notes: 'Corrected invoice' }), args,
    );

    expect(JSON.parse(response.body.result.content[0].text).notes).toBe('Corrected invoice');
  });

  test('preserves not-found errors for records outside the tenant', async () => {
    const response = await call(
      'uteamup_sustainability_energy_reading_get',
      { readingGuid },
      errorReply(-32602, 'The energy reading was not found in the current tenant.'),
    );

    expect(response.body.error.code).toBe(-32602);
    expect(response.body.error.message).toContain('current tenant');
  });

  test('preserves validation errors for unknown enum names', async () => {
    const response = await call(
      'uteamup_sustainability_energy_anomaly_list',
      { status: 'Closed' },
      errorReply(-32602, 'status must be one of: New, Acknowledged, Investigating, Resolved, FalsePositive.'),
    );

    expect(response.body.error.message).toContain('status must be one of');
  });

  const tools = [
    { name: 'uteamup_sustainability_energy_reading_list', args: { page: 1, pageSize: 25 } },
    { name: 'uteamup_sustainability_energy_reading_get', args: { readingGuid } },
    { name: 'uteamup_sustainability_energy_reading_create', args: { utilityMeterGuid: meterGuid, readingValue: 1, readingDate: '2026-11-01T00:00:00Z' } },
    { name: 'uteamup_sustainability_water_reading_list', args: { page: 1, pageSize: 25 } },
    { name: 'uteamup_sustainability_waste_record_get', args: { recordGuid: readingGuid } },
    { name: 'uteamup_sustainability_carbon_emission_list', args: { page: 1, pageSize: 25 } },
    { name: 'uteamup_sustainability_emission_factor_list', args: { page: 1, pageSize: 25 } },
    { name: 'uteamup_sustainability_energy_benchmark_get', args: { benchmarkGuid: readingGuid } },
    { name: 'uteamup_sustainability_goal_list', args: { includeInactive: false } },
    { name: 'uteamup_sustainability_energy_anomaly_get', args: { anomalyGuid: readingGuid } },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
