/**
 * UteamupWeatherSiteWindows MCP tool test.
 *
 * Backend tool: GetSiteWeatherWindowsMcpCommand + Handler (mirrors GET /api/weather/windows).
 * Read-only: the next 72 hours of workable, unworkable and unknown windows for the tenant's
 * limited sea sites, from MET Norway (CC BY 4.0). Requires Weather.Read and the Weather
 * Monitoring feature; the tenant comes from the token, never from an argument.
 * Generic-proxy pattern (nock-mocked backend; no real network).
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('UteamupWeatherSiteWindows MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_weather_windows';
  const TOOL_NAME = 'UteamupWeatherSiteWindows';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, TOOL_NAME, toolArgs, mockReply, expectedArgs);

  const locationGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const attribution = 'Weather data: MET Norway (CC BY 4.0), https://api.met.no';

  const closing = {
    startUtc: '2026-09-24T18:00:00Z',
    endUtc: '2026-09-25T00:00:00Z',
    state: 'unworkable',
    limitingFactors: ['waves'],
    unknownFactors: ['gust'],
    peakWindMs: 9.5,
    peakWaveM: 2.4,
  };

  const site = {
    locationGuid,
    locationName: 'Dýrafjörður sea site',
    maxWindSpeedMs: 12,
    maxGustMs: 18,
    maxWaveHeightM: 1.5,
    forecastAvailable: true,
    gustAvailable: false,
    wavesAvailable: true,
    currentState: 'unknown',
    nextUnworkable: closing,
    closesWithinHours: 6,
    windows: [
      {
        startUtc: '2026-09-24T12:00:00Z',
        endUtc: '2026-09-24T18:00:00Z',
        state: 'unknown',
        limitingFactors: [],
        unknownFactors: ['gust'],
        peakWindMs: 8,
      },
      closing,
    ],
    steps: [],
    source: 'MET Norway',
    attribution,
  };

  const summary = (sites, truncated = false) => ({
    generatedAtUtc: '2026-09-24T12:00:00Z',
    horizonHours: 72,
    truncated,
    sites,
    source: 'MET Norway',
    attribution,
  });

  it('returns the windows with honest unknowns and the MET Norway attribution', async () => {
    const response = await call({}, successReply(summary([site])));

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.horizonHours).toBe(72);
    expect(data.attribution).toMatch(/MET Norway \(CC BY 4\.0\)/);
    expect(data.sites).toHaveLength(1);
    expect(data.sites[0].gustAvailable).toBe(false);
    expect(data.sites[0].currentState).toBe('unknown');
    expect(data.sites[0].nextUnworkable.limitingFactors).toEqual(['waves']);
    expect(data.sites[0]).not.toHaveProperty('id');
  });

  it('returns an empty site list when no location has limits', async () => {
    const response = await call({}, successReply(summary([])));

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.sites).toEqual([]);
    expect(data.truncated).toBe(false);
  });

  it('forwards the location GUID verbatim and adds no tenant or user argument', async () => {
    const args = { locationGuid };

    // nock only matches when params.arguments deep-equal `args`, so a 200 proves the proxy
    // neither dropped the GUID nor added a tenant, user or integer id.
    const response = await call(args, successReply(summary([site])), args);

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.sites[0].locationGuid).toBe(locationGuid);
  });

  it('surfaces an unknown or foreign location as a JSON-RPC error', async () => {
    const response = await call(
      { locationGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      errorReply(-32000, 'Location not found.'),
    );

    expect(response.body.error.message).toMatch(/not found/i);
    expect(response.body.result).toBeUndefined();
  });

  it('passes through a permission or feature denial', async () => {
    const response = await call({}, errorReply(-32000, 'Permission denied: Weather.Read required'));

    expect(response.body.error.message).toMatch(/Weather\.Read/);
  });

  const tools = [{ name: TOOL_NAME, args: { locationGuid } }];
  describeJsonRpcCompliance(
    (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply),
    tools,
  );
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
