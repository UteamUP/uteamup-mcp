/**
 * UteamupWeatherGetForCoordinates MCP tool test.
 *
 * Backend tool: GetCoordinateWeatherMcpCommand + Handler (mirrors GET /api/weather/coordinates).
 * Read-only: current weather at a coordinate that is not a location (a contact's or the company's
 * address). The backend rounds to two decimals (about 1 km) and answers with the rounded coordinate;
 * it raises no severe-weather alert. Requires Weather.Read and the Weather Monitoring feature; the
 * tenant comes from the token, never from an argument.
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

describe('UteamupWeatherGetForCoordinates MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_weather_coordinates';
  const TOOL_NAME = 'UteamupWeatherGetForCoordinates';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, TOOL_NAME, toolArgs, mockReply, expectedArgs);

  const args = { latitude: 64.1466, longitude: -21.9426 };

  const weather = {
    latitude: 64.15,
    longitude: -21.94,
    temperatureCelsius: 3.1,
    feelsLikeCelsius: -1.2,
    humidity: 81,
    windSpeedKmh: 23,
    windDirectionDegrees: 250,
    visibilityKm: 0,
    cloudCoverPercent: 100,
    conditionMain: 'Clouds',
    conditionDescription: 'overcast clouds',
    conditionIconCode: '04d',
    conditionCode: 804,
    sunriseUtc: '2026-11-13T10:03:00Z',
    sunsetUtc: '2026-11-13T16:21:00Z',
    observedAtUtc: '2026-11-13T10:00:00Z',
    cachedAtUtc: '2026-11-13T10:01:00Z',
    hasSevereWeatherAlert: false,
  };

  it('returns the reading for the rounded coordinate with no location or tenant identity', async () => {
    const response = await call(args, successReply(weather));

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.latitude).toBe(64.15);
    expect(data.longitude).toBe(-21.94);
    expect(data.conditionDescription).toBe('overcast clouds');
    expect(data).not.toHaveProperty('locationGuid');
    expect(data).not.toHaveProperty('tenantGuid');
    expect(data).not.toHaveProperty('locationId');
  });

  it('surfaces a null reading when the provider has none', async () => {
    const response = await call(args, successReply(null));

    expect(response.status).toBe(200);
    expect(response.body.error).toBeUndefined();
    expect(JSON.parse(response.body.result.content[0].text)).toBeNull();
  });

  it('forwards both coordinates verbatim and adds no tenant or user argument', async () => {
    // nock only matches when params.arguments deep-equal `args`, so a 200 proves the proxy
    // neither rounded, dropped nor added an argument.
    const response = await call(args, successReply(weather), args);

    expect(response.status).toBe(200);
  });

  it('surfaces an out-of-range coordinate as a JSON-RPC error', async () => {
    const response = await call(
      { latitude: 91, longitude: 0 },
      errorReply(-32602, 'Latitude must be between -90 and 90.'),
    );

    expect(response.body.error.message).toMatch(/between -90 and 90/);
    expect(response.body.result).toBeUndefined();
  });

  it('passes through a permission or feature denial', async () => {
    const response = await call(args, errorReply(-32000, 'Permission denied: Weather.Read required'));

    expect(response.body.error.message).toMatch(/Weather\.Read/);
  });

  const tools = [{ name: TOOL_NAME, args }];
  describeJsonRpcCompliance(
    (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply),
    tools,
  );
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
