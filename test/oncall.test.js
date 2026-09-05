/**
 * On-Call MCP tool tests
 *
 * Tests that the on-call MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error
 * responses from the backend /mcp endpoint.
 *
 * Tools under test (all identifiers are GUIDs — never integer ids):
 *   UteamupOncallScheduleList()
 *   UteamupOncallWhoIsOnCall(scheduleGuid?, atUtc?)
 *   UteamupOncallActiveCallouts()
 *
 * All three tools are tenant-scoped via the Bearer token — none of them
 * takes a userId/tenantId argument.
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

describe('On-Call MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_oncall';

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
  const SCHEDULE_GUID = '11111111-2222-3333-4444-555555555555';
  const AT_UTC = '2026-07-18T02:30:00Z';

  test('pages coverage history with saved decision evidence and public schedule GUIDs', async () => {
    const args = { history: true, page: 2, pageSize: 25, scheduleGuid: SCHEDULE_GUID };
    const saved = { requestGuid: '11111111-2222-3333-4444-555555555556',
      approvedCoverUserGuid: '11111111-2222-3333-4444-555555555557', approvedCoverUserName: 'Approved Worker',
      reviewedByUserName: 'Reviewing Manager', decisionEvidenceVersion: 1, reviewNotes: 'Agreed with the team' };
    const response = await callWithArgCapture('UteamupOncallCoverageRequests', args,
      successReply({ items: [saved], totalItems: 26, page: 2, pageSize: 25, totalPages: 2 }));
    expect(response.capturedArgs).toEqual(args);
    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.items[0]).toEqual(saved);
    expect(result.page).toBe(2);
  });

  const scheduleList = [
    {
      scheduleGuid: SCHEDULE_GUID,
      name: 'Electrical — Night Shift',
      rotationType: 'weekly',
      isActive: true,
      memberCount: 4
    },
    {
      scheduleGuid: '66666666-7777-8888-9999-aaaaaaaaaaaa',
      name: 'Mechanical — Weekend',
      rotationType: 'daily',
      isActive: true,
      memberCount: 2
    }
  ];

  const whoIsOnCall = [
    {
      scheduleGuid: SCHEDULE_GUID,
      scheduleName: 'Electrical — Night Shift',
      userGuid: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
      userName: 'Jane Technician',
      shiftStartUtc: '2026-07-17T22:00:00Z',
      shiftEndUtc: '2026-07-18T06:00:00Z',
      isPrimary: true
    }
  ];

  const activeCallouts = [
    {
      calloutGuid: 'cccccccc-dddd-eeee-ffff-000000000001',
      scheduleGuid: SCHEDULE_GUID,
      workorderGuid: 'dddddddd-eeee-ffff-0000-111111111111',
      calledUserName: 'Jane Technician',
      status: 'Acknowledged',
      raisedAtUtc: '2026-07-18T01:12:00Z'
    }
  ];

  // ---------------------------------------------------------------------------
  // UteamupOncallScheduleList
  // ---------------------------------------------------------------------------
  describe('UteamupOncallScheduleList tool', () => {
    test('returns the on-call schedules for the tenant', async () => {
      const response = await call(
        'UteamupOncallScheduleList',
        {},
        successReply(scheduleList)
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const schedules = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(schedules)).toBe(true);
      expect(schedules).toHaveLength(2);
      expect(schedules[0].scheduleGuid).toBe(SCHEDULE_GUID);
      expect(schedules[0].name).toBe('Electrical — Night Shift');
    });

    test('returns an empty array when the tenant has no on-call schedules', async () => {
      const response = await call(
        'UteamupOncallScheduleList',
        {},
        successReply([])
      );

      expect(response.status).toBe(200);
      const schedules = JSON.parse(response.body.result.content[0].text);
      expect(schedules).toEqual([]);
    });

    test('handles backend error responses in JSON-RPC error shape', async () => {
      const response = await call(
        'UteamupOncallScheduleList',
        {},
        errorReply(-32603, 'Internal error: database unavailable')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32603);
      expect(response.body.error.message).toContain('database unavailable');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupOncallWhoIsOnCall
  // ---------------------------------------------------------------------------
  describe('UteamupOncallWhoIsOnCall tool', () => {
    test('returns who is on call right now with no arguments (all schedules)', async () => {
      const response = await callWithArgCapture(
        'UteamupOncallWhoIsOnCall',
        {},
        successReply(whoIsOnCall)
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      expect(response.capturedArgs).toEqual({});
      const onCall = JSON.parse(response.body.result.content[0].text);
      expect(onCall).toHaveLength(1);
      expect(onCall[0].userName).toBe('Jane Technician');
      expect(onCall[0].isPrimary).toBe(true);
    });

    test('forwards scheduleGuid and atUtc verbatim', async () => {
      const response = await callWithArgCapture(
        'UteamupOncallWhoIsOnCall',
        { scheduleGuid: SCHEDULE_GUID, atUtc: AT_UTC },
        successReply(whoIsOnCall)
      );

      expect(response.status).toBe(200);
      expect(response.capturedArgs).toEqual({ scheduleGuid: SCHEDULE_GUID, atUtc: AT_UTC });
      const onCall = JSON.parse(response.body.result.content[0].text);
      expect(onCall[0].scheduleGuid).toBe(SCHEDULE_GUID);
    });

    test('returns an empty array when nobody is on call for the schedule', async () => {
      const response = await call(
        'UteamupOncallWhoIsOnCall',
        { scheduleGuid: SCHEDULE_GUID },
        successReply([])
      );

      expect(response.status).toBe(200);
      const onCall = JSON.parse(response.body.result.content[0].text);
      expect(onCall).toEqual([]);
    });

    test('handles backend error responses in JSON-RPC error shape', async () => {
      const response = await call(
        'UteamupOncallWhoIsOnCall',
        { scheduleGuid: '00000000-0000-0000-0000-000000000000' },
        errorReply(-32602, 'On-call schedule not found in tenant.')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupOncallActiveCallouts
  // ---------------------------------------------------------------------------
  describe('UteamupOncallActiveCallouts tool', () => {
    test('returns the active callouts for the tenant', async () => {
      const response = await call(
        'UteamupOncallActiveCallouts',
        {},
        successReply(activeCallouts)
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const callouts = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(callouts)).toBe(true);
      expect(callouts).toHaveLength(1);
      expect(callouts[0].calloutGuid).toBe('cccccccc-dddd-eeee-ffff-000000000001');
      expect(callouts[0].status).toBe('Acknowledged');
    });

    test('returns an empty array when no callouts are active', async () => {
      const response = await call(
        'UteamupOncallActiveCallouts',
        {},
        successReply([])
      );

      expect(response.status).toBe(200);
      const callouts = JSON.parse(response.body.result.content[0].text);
      expect(callouts).toEqual([]);
    });

    test('handles backend error responses in JSON-RPC error shape', async () => {
      const response = await call(
        'UteamupOncallActiveCallouts',
        {},
        errorReply(-32000, 'Permission denied: Oncall.View required')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Oncall.View');
    });

    test('sends NO userId/tenantId argument — identity comes from the Bearer token', async () => {
      // Regression guard: the backend resolves user + tenant from the Bearer
      // token. A userId/tenantId arg on any on-call tool would silently
      // invite spoofing another tenant's callout queue.
      const response = await callWithArgCapture(
        'UteamupOncallActiveCallouts',
        {},
        successReply(activeCallouts)
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
    { name: 'UteamupOncallCoverageRequests', args: { history: true, page: 1, pageSize: 25 } },
    { name: 'UteamupOncallScheduleList', args: {} },
    { name: 'UteamupOncallWhoIsOnCall', args: { scheduleGuid: SCHEDULE_GUID, atUtc: AT_UTC } },
    { name: 'UteamupOncallActiveCallouts', args: {} }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
