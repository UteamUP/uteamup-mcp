/**
 * Attendance Station MCP tool tests
 *
 * Tests that the attendance-station MCP tool calls are correctly formed as
 * JSON-RPC 2.0 requests and that the MCP proxy properly handles both
 * successful and error responses from the backend /mcp endpoint.
 *
 * Tools under test (all identifiers are GUIDs — never integer ids):
 *   UteamupAttendanceStationList(activeOnly)
 *   UteamupAttendanceStationGetByGuid(stationGuid)
 *   UteamupAttendanceCorrectionsPending()   — user/tenant scoped via Bearer token
 *
 * Pattern mirrors labour-rate.test.js: raw nock-mocked HTTPS calls that
 * simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const https = require('https');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
} = require('./helpers/mcp-error-tests');

describe('Attendance Station MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_attendance_station';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  /**
   * Like callMcpTool, but also captures the forwarded params.arguments so
   * tests can assert the args round-trip verbatim (GUIDs untouched, no
   * injected fields).
   */
  function callWithArgCapture(toolName, toolArgs, mockReply) {
    const captured = {};
    nock(BASE_URL)
      .post('/mcp', body => {
        if (body.method === 'tools/call' && body.params?.name === toolName) {
          captured.args = body.params.arguments;
          return true;
        }
        return false;
      })
      .reply(mockReply.status, JSON.stringify(mockReply.body), { 'Content-Type': 'application/json' });

    const request = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: toolArgs },
      id: Math.floor(Math.random() * 10000)
    };

    return new Promise((resolve, reject) => {
      const data = JSON.stringify(request);
      const req = https.request(`${BASE_URL}/mcp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Content-Length': Buffer.byteLength(data)
        },
        rejectUnauthorized: false
      }, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(responseData), capturedArgs: captured.args });
          } catch {
            resolve({ status: res.statusCode, body: responseData, capturedArgs: captured.args });
          }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------
  const STATION_GUID = '11111111-2222-3333-4444-555555555555';

  const mainGateStation = {
    stationGuid: STATION_GUID,
    name: 'Main Gate Kiosk',
    locationName: 'Plant A — Main Gate',
    isActive: true
  };

  const warehouseStation = {
    stationGuid: '66666666-7777-8888-9999-aaaaaaaaaaaa',
    name: 'Warehouse Terminal',
    locationName: 'Plant A — Warehouse',
    isActive: false
  };

  const stationList = [mainGateStation, warehouseStation];

  const pendingCorrections = [
    {
      correctionGuid: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
      stationGuid: STATION_GUID,
      requestedByName: 'Jane Technician',
      originalClockInUtc: '2026-07-17T07:02:00Z',
      correctedClockInUtc: '2026-07-17T06:45:00Z',
      reason: 'Badge reader was offline',
      status: 'Pending'
    },
    {
      correctionGuid: 'cccccccc-dddd-eeee-ffff-000000000001',
      stationGuid: STATION_GUID,
      requestedByName: 'John Operator',
      originalClockOutUtc: null,
      correctedClockOutUtc: '2026-07-16T15:30:00Z',
      reason: 'Forgot to clock out',
      status: 'Pending'
    }
  ];

  // ---------------------------------------------------------------------------
  // UteamupAttendanceStationList
  // ---------------------------------------------------------------------------
  describe('UteamupAttendanceStationList tool', () => {
    test('returns the list of attendance stations', async () => {
      const response = await call(
        'UteamupAttendanceStationList',
        { activeOnly: true },
        successReply([mainGateStation])
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const stations = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(stations)).toBe(true);
      expect(stations).toHaveLength(1);
      expect(stations[0].stationGuid).toBe(STATION_GUID);
      expect(stations[0].name).toBe('Main Gate Kiosk');
      expect(stations[0].isActive).toBe(true);
    });

    test('returns an empty array when the tenant has no stations', async () => {
      const response = await call(
        'UteamupAttendanceStationList',
        { activeOnly: true },
        successReply([])
      );

      expect(response.status).toBe(200);
      const stations = JSON.parse(response.body.result.content[0].text);
      expect(stations).toEqual([]);
    });

    test('forwards activeOnly=false verbatim and returns inactive stations too', async () => {
      const response = await callWithArgCapture(
        'UteamupAttendanceStationList',
        { activeOnly: false },
        successReply(stationList)
      );

      expect(response.status).toBe(200);
      expect(response.capturedArgs).toEqual({ activeOnly: false });
      const stations = JSON.parse(response.body.result.content[0].text);
      expect(stations).toHaveLength(2);
      expect(stations[1].isActive).toBe(false);
    });

    test('handles backend error responses in JSON-RPC error shape', async () => {
      const response = await call(
        'UteamupAttendanceStationList',
        { activeOnly: true },
        errorReply(-32603, 'Internal error: database unavailable')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32603);
      expect(response.body.error.message).toContain('database unavailable');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupAttendanceStationGetByGuid
  // ---------------------------------------------------------------------------
  describe('UteamupAttendanceStationGetByGuid tool', () => {
    test('returns the station for a known Guid', async () => {
      const response = await call(
        'UteamupAttendanceStationGetByGuid',
        { stationGuid: STATION_GUID },
        successReply(mainGateStation)
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const station = JSON.parse(response.body.result.content[0].text);
      expect(station.stationGuid).toBe(STATION_GUID);
      expect(station.name).toBe('Main Gate Kiosk');
    });

    test('returns null when the station Guid is unknown in the tenant', async () => {
      const response = await call(
        'UteamupAttendanceStationGetByGuid',
        { stationGuid: '00000000-0000-0000-0000-000000000000' },
        successReply(null)
      );

      expect(response.status).toBe(200);
      const station = JSON.parse(response.body.result.content[0].text);
      expect(station).toBeNull();
    });

    test('handles backend error responses in JSON-RPC error shape', async () => {
      const response = await call(
        'UteamupAttendanceStationGetByGuid',
        { stationGuid: STATION_GUID },
        errorReply(-32000, 'Permission denied: Attendance.View required')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Attendance.View');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupAttendanceCorrectionsPending
  // ---------------------------------------------------------------------------
  describe('UteamupAttendanceCorrectionsPending tool', () => {
    test('returns the pending attendance corrections', async () => {
      const response = await call(
        'UteamupAttendanceCorrectionsPending',
        {},
        successReply(pendingCorrections)
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const corrections = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(corrections)).toBe(true);
      expect(corrections).toHaveLength(2);
      expect(corrections[0].correctionGuid).toBe('bbbbbbbb-cccc-dddd-eeee-ffffffffffff');
      expect(corrections[0].status).toBe('Pending');
    });

    test('returns an empty array when nothing awaits correction approval', async () => {
      const response = await call(
        'UteamupAttendanceCorrectionsPending',
        {},
        successReply([])
      );

      expect(response.status).toBe(200);
      const corrections = JSON.parse(response.body.result.content[0].text);
      expect(corrections).toEqual([]);
    });

    test('handles backend error responses in JSON-RPC error shape', async () => {
      const response = await call(
        'UteamupAttendanceCorrectionsPending',
        {},
        errorReply(-32603, 'Internal error: database unavailable')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32603);
    });

    test('sends NO userId/tenantId argument — identity comes from the Bearer token', async () => {
      // Regression guard: the backend resolves user + tenant from the Bearer
      // token. A userId/tenantId arg on this tool would silently invite
      // spoofing another user's pending corrections.
      const response = await callWithArgCapture(
        'UteamupAttendanceCorrectionsPending',
        {},
        successReply(pendingCorrections)
      );

      expect(response.status).toBe(200);
      expect(response.capturedArgs).toEqual({});
      expect(Object.keys(response.capturedArgs)).not.toContain('userId');
      expect(Object.keys(response.capturedArgs)).not.toContain('tenantId');
    });
  });

  // ---------------------------------------------------------------------------
  // Reusable error suites (JSON-RPC compliance, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupAttendanceStationList', args: { activeOnly: true } },
    { name: 'UteamupAttendanceStationGetByGuid', args: { stationGuid: STATION_GUID } },
    { name: 'UteamupAttendanceCorrectionsPending', args: {} }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
