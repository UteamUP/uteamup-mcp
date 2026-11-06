/**
 * UteamupUtilityMeterArchive and UteamupUtilityMeterRestore MCP tool tests.
 *
 * Backend tools: ArchiveUtilityMeterCommand / RestoreUtilityMeterCommand + UtilityMeterArchiveCommandHandler.
 * A utility meter with readings is marked inactive instead of deleted: it leaves meter lists and reading
 * pickers and keeps every energy and water reading. Both tools need UtilityMeter.Delete.
 *
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
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Utility meter archive MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_utility_meter_archive';

  const METER = 'cccccccc-0000-4000-8000-000000000001';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (tool, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, tool, toolArgs, mockReply);

  it('marks a meter inactive and returns its state', async () => {
    const response = await call(
      'UteamupUtilityMeterArchive',
      { meterGuid: METER },
      successReply({ guid: METER, isActive: false, updatedAt: '2026-11-06T12:00:00Z' }),
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.guid).toBe(METER);
    expect(data.isActive).toBe(false);
  });

  it('reactivates an inactive meter', async () => {
    const response = await call(
      'UteamupUtilityMeterRestore',
      { meterGuid: METER },
      successReply({ guid: METER, isActive: true, updatedAt: '2026-11-06T12:05:00Z' }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.isActive).toBe(true);
  });

  it('surfaces a missing UtilityMeter.Delete right as a JSON-RPC error', async () => {
    const response = await call(
      'UteamupUtilityMeterArchive',
      { meterGuid: METER },
      errorReply(-32000, 'Permission denied: UtilityMeter.Delete required'),
    );

    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/UtilityMeter\.Delete/);
  });

  it('surfaces a meter outside the tenant as not_found', async () => {
    const response = await call(
      'UteamupUtilityMeterRestore',
      { meterGuid: METER },
      errorReply(-32000, 'not_found: Utility meter unavailable.'),
    );

    expect(response.body.error.message).toMatch(/not_found/);
  });

  it('surfaces an empty meter GUID as an argument error', async () => {
    const response = await call(
      'UteamupUtilityMeterArchive',
      { meterGuid: '00000000-0000-0000-0000-000000000000' },
      errorReply(-32602, 'meterGuid must be a non-empty GUID.'),
    );

    expect(response.body.error.message).toMatch(/non-empty GUID/);
  });

  const errorTools = [
    { name: 'UteamupUtilityMeterArchive', args: { meterGuid: METER } },
    { name: 'UteamupUtilityMeterRestore', args: { meterGuid: METER } },
  ];
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
