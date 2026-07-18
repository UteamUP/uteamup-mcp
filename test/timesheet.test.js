/**
 * Timesheet MCP tool tests
 *
 * Tests that the timesheet MCP tool calls are correctly formed as JSON-RPC
 * 2.0 requests and that the MCP proxy properly handles both successful and
 * error responses from the backend /mcp endpoint.
 *
 * Tools under test (all identifiers are GUIDs — never integer ids):
 *   UteamupTimesheetWeeklyMine(weekStart)   — the ACTOR comes from the Bearer token
 *   UteamupTimesheetPendingApprovals()
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

describe('Timesheet MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_timesheet';

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
  const WEEK_START = '2026-07-13';

  const weeklyGrid = {
    weekStart: WEEK_START,
    rows: [
      {
        workorderGuid: '11111111-2222-3333-4444-555555555555',
        workorderTicketId: 'WO-0000000012',
        workorderName: 'Pump P-101 seal replacement',
        hoursByDay: [8, 6.5, 0, 4, 8, 0, 0],
        rowTotal: 26.5
      },
      {
        workorderGuid: '66666666-7777-8888-9999-aaaaaaaaaaaa',
        workorderTicketId: 'WO-0000000015',
        workorderName: 'Conveyor belt inspection',
        hoursByDay: [0, 1.5, 8, 4, 0, 0, 0],
        rowTotal: 13.5
      }
    ],
    weekTotal: 40.0,
    status: 'Draft'
  };

  const pendingApprovals = [
    {
      timesheetGuid: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
      userName: 'Jane Technician',
      weekStart: WEEK_START,
      weekTotal: 40.0,
      submittedAtUtc: '2026-07-17T16:05:00Z',
      status: 'Submitted'
    },
    {
      timesheetGuid: 'cccccccc-dddd-eeee-ffff-000000000001',
      userName: 'John Operator',
      weekStart: '2026-07-06',
      weekTotal: 37.5,
      submittedAtUtc: '2026-07-10T14:40:00Z',
      status: 'Submitted'
    }
  ];

  // ---------------------------------------------------------------------------
  // UteamupTimesheetWeeklyMine
  // ---------------------------------------------------------------------------
  describe('UteamupTimesheetWeeklyMine tool', () => {
    test('returns the weekly timesheet grid for the current user', async () => {
      const response = await call(
        'UteamupTimesheetWeeklyMine',
        { weekStart: WEEK_START },
        successReply(weeklyGrid)
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const grid = JSON.parse(response.body.result.content[0].text);
      expect(grid.weekStart).toBe(WEEK_START);
      expect(Array.isArray(grid.rows)).toBe(true);
      expect(grid.rows).toHaveLength(2);
      expect(grid.rows[0].workorderGuid).toBe('11111111-2222-3333-4444-555555555555');
      expect(grid.rows[0].rowTotal).toBe(26.5);
      expect(grid.weekTotal).toBe(40.0);
    });

    test('handles backend error responses in JSON-RPC error shape', async () => {
      const response = await call(
        'UteamupTimesheetWeeklyMine',
        { weekStart: 'not-a-date' },
        errorReply(-32602, 'weekStart must be an ISO date (yyyy-MM-dd) falling on a Monday')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32602);
      expect(response.body.error.message).toContain('weekStart');
    });

    test('sends ONLY weekStart — NO userId argument, the actor comes from the Bearer token', async () => {
      // Regression guard: the backend resolves the timesheet owner from the
      // Bearer token. A userId arg on this tool would silently let a caller
      // read (or submit) another user's timesheet.
      const response = await callWithArgCapture(
        'UteamupTimesheetWeeklyMine',
        { weekStart: WEEK_START },
        successReply(weeklyGrid)
      );

      expect(response.status).toBe(200);
      expect(response.capturedArgs).toEqual({ weekStart: WEEK_START });
      expect(Object.keys(response.capturedArgs)).toEqual(['weekStart']);
      expect(Object.keys(response.capturedArgs)).not.toContain('userId');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupTimesheetPendingApprovals
  // ---------------------------------------------------------------------------
  describe('UteamupTimesheetPendingApprovals tool', () => {
    test('returns the timesheets awaiting approval', async () => {
      const response = await call(
        'UteamupTimesheetPendingApprovals',
        {},
        successReply(pendingApprovals)
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const approvals = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(approvals)).toBe(true);
      expect(approvals).toHaveLength(2);
      expect(approvals[0].timesheetGuid).toBe('bbbbbbbb-cccc-dddd-eeee-ffffffffffff');
      expect(approvals[0].status).toBe('Submitted');
    });

    test('returns an empty array when nothing awaits approval', async () => {
      const response = await call(
        'UteamupTimesheetPendingApprovals',
        {},
        successReply([])
      );

      expect(response.status).toBe(200);
      const approvals = JSON.parse(response.body.result.content[0].text);
      expect(approvals).toEqual([]);
    });

    test('handles backend error responses in JSON-RPC error shape', async () => {
      const response = await call(
        'UteamupTimesheetPendingApprovals',
        {},
        errorReply(-32000, 'Permission denied: Timesheet.Approve required')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Timesheet.Approve');
    });
  });

  // ---------------------------------------------------------------------------
  // Reusable error suites (JSON-RPC compliance, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupTimesheetWeeklyMine', args: { weekStart: WEEK_START } },
    { name: 'UteamupTimesheetPendingApprovals', args: {} }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
