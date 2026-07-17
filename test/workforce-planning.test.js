/**
 * Workforce Planning MCP tool tests
 *
 * Tests that WorkforcePlanning MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error
 * responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   UteamupWorkforceGetPlanningGrid        — get the planning grid for a date range
 *   UteamupWorkforceGetGroupMembers        — get workforce group members for per-member rows
 *   UteamupWorkforceAssignWorkOrder        — assign work order to a specific group member
 *
 * Pattern mirrors schedule.test.js: raw nock-mocked HTTPS calls that simulate
 * what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const https = require('https');
const { callMcpTool: _callMcpTool } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Workforce Planning MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const guid = value => `00000000-0000-0000-0000-${String(value).padStart(12, '0')}`;
  const ACCESS_TOKEN = 'test_access_token_workforce_planning_tools';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------
  const grid = {
    dateFrom: '2026-03-01T00:00:00Z',
    dateTo: '2026-03-07T00:00:00Z',
    dates: ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07'],
    holidayDates: ['2026-03-03'],
    shiftRows: [
      {
        shiftGuid: guid(1),
        shiftName: 'Morning Shift',
        shiftColorCode: '#3B82F6',
        startTime: '08:00:00',
        endTime: '16:00:00',
        spansOvernight: false,
        categoryGroups: [
          {
            categoryGuid: guid(1),
            categoryName: 'Electrical Day',
            categoryColorCode: '#3B82F6',
            assignmentsByDate: {
              '2026-03-01': [{ assignmentGuid: guid(10), userGuid: guid(101), userName: 'Alice', status: 'Assigned' }],
              '2026-03-02': []
            }
          }
        ],
        instancesByDate: {
          '2026-03-01': { instanceGuid: guid(5), instanceDate: '2026-03-01T00:00:00Z', status: 'Published', isHoliday: false, assignedCount: 1, workOrderCount: 2 },
          '2026-03-02': null
        }
      }
    ],
    totalWorkOrders: 5,
    unassignedWorkOrders: 2
  };

  // ---------------------------------------------------------------------------
  // UteamupWorkforceGetPlanningGrid
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceGetPlanningGrid tool', () => {
    test('returns grid with shiftRows for valid date range', async () => {
      const response = await call(
        'UteamupWorkforceGetPlanningGrid',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(grid) }] },
            id: 1
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.dateFrom).toBe('2026-03-01T00:00:00Z');
      expect(result.dateTo).toBe('2026-03-07T00:00:00Z');
      expect(Array.isArray(result.shiftRows)).toBe(true);
      expect(result.shiftRows.length).toBe(1);
      expect(result.shiftRows[0].shiftName).toBe('Morning Shift');
    });

    test('grid has correct dates array with 7 entries for a 7-day range', async () => {
      const response = await call(
        'UteamupWorkforceGetPlanningGrid',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(grid) }] },
            id: 2
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(result.dates)).toBe(true);
      expect(result.dates.length).toBe(7);
      expect(result.dates[0]).toBe('2026-03-01');
      expect(result.dates[6]).toBe('2026-03-07');
    });

    test('holiday dates are included in holidayDates array', async () => {
      const response = await call(
        'UteamupWorkforceGetPlanningGrid',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(grid) }] },
            id: 3
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(result.holidayDates)).toBe(true);
      expect(result.holidayDates).toContain('2026-03-03');
      expect(result.holidayDates.length).toBe(1);
    });

    test('categoryGuids filter returns filtered grid with only matching category groups', async () => {
      const filteredGrid = {
        ...grid,
        shiftRows: [
          {
            ...grid.shiftRows[0],
            categoryGroups: grid.shiftRows[0].categoryGroups.filter(cg => cg.categoryGuid === 1)
          }
        ]
      };

      const response = await call(
        'UteamupWorkforceGetPlanningGrid',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07', categoryGuids: [guid(1)] },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(filteredGrid) }] },
            id: 4
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.shiftRows[0].categoryGroups.length).toBe(1);
      expect(result.shiftRows[0].categoryGroups[0].categoryGuid).toBe(guid(1));
    });

    test('returns empty shiftRows array when no shifts are configured', async () => {
      const emptyGrid = {
        ...grid,
        shiftRows: [],
        totalWorkOrders: 0,
        unassignedWorkOrders: 0
      };

      const response = await call(
        'UteamupWorkforceGetPlanningGrid',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(emptyGrid) }] },
            id: 5
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(result.shiftRows)).toBe(true);
      expect(result.shiftRows.length).toBe(0);
    });

    test('grid contains assignment data per user per date in categoryGroups', async () => {
      const response = await call(
        'UteamupWorkforceGetPlanningGrid',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(grid) }] },
            id: 6
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      const categoryGroup = result.shiftRows[0].categoryGroups[0];
      expect(categoryGroup.categoryName).toBe('Electrical Day');
      expect(Array.isArray(categoryGroup.assignmentsByDate['2026-03-01'])).toBe(true);
      expect(categoryGroup.assignmentsByDate['2026-03-01'].length).toBe(1);
      expect(categoryGroup.assignmentsByDate['2026-03-01'][0].userGuid).toBe(guid(101));
      expect(categoryGroup.assignmentsByDate['2026-03-01'][0].userName).toBe('Alice');
    });

    test('instancesByDate includes workOrderCount and assignedCount for published instances', async () => {
      const response = await call(
        'UteamupWorkforceGetPlanningGrid',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(grid) }] },
            id: 7
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      const instanceOnMarch1 = result.shiftRows[0].instancesByDate['2026-03-01'];
      expect(instanceOnMarch1).not.toBeNull();
      expect(instanceOnMarch1.instanceGuid).toBe(guid(5));
      expect(instanceOnMarch1.workOrderCount).toBe(2);
      expect(instanceOnMarch1.assignedCount).toBe(1);
      expect(instanceOnMarch1.status).toBe('Published');
    });

    test('returns permission error when ShiftInstance.Read is missing', async () => {
      const response = await call(
        'UteamupWorkforceGetPlanningGrid',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: ShiftInstance.Read required' },
            id: 8
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('ShiftInstance.Read');
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const response = await call(
        'UteamupWorkforceGetPlanningGrid',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(grid) }] },
            id: 9
          }
        }
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(9);
    });

    test('totalWorkOrders and unassignedWorkOrders are present in the grid response', async () => {
      const response = await call(
        'UteamupWorkforceGetPlanningGrid',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(grid) }] },
            id: 10
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(typeof result.totalWorkOrders).toBe('number');
      expect(typeof result.unassignedWorkOrders).toBe('number');
      expect(result.totalWorkOrders).toBe(5);
      expect(result.unassignedWorkOrders).toBe(2);
    });

    test('includes dateFrom, dateTo, and optional categoryGuids in request params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => { capturedBody = body; return true; })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(grid) }] },
          id: 11
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupWorkforceGetPlanningGrid',
          arguments: { dateFrom: '2026-03-01', dateTo: '2026-03-07', categoryGuids: [guid(1), guid(2)] }
        },
        id: 11
      };

      await new Promise((resolve, reject) => {
        const data = JSON.stringify(requestPayload);
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
          rejectUnauthorized: false
        }, (res) => {
          res.on('data', () => {});
          res.on('end', resolve);
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(capturedBody).not.toBeNull();
      expect(capturedBody.params.arguments.dateFrom).toBe('2026-03-01');
      expect(capturedBody.params.arguments.dateTo).toBe('2026-03-07');
      expect(capturedBody.params.arguments.categoryGuids).toEqual([1, 2]);
    });

    test('instancesByDate is null for dates with no instance', async () => {
      const response = await call(
        'UteamupWorkforceGetPlanningGrid',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(grid) }] },
            id: 12
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      const instanceOnMarch2 = result.shiftRows[0].instancesByDate['2026-03-02'];
      expect(instanceOnMarch2).toBeNull();
    });

    test('returns error for missing dateFrom parameter', async () => {
      const response = await call(
        'UteamupWorkforceGetPlanningGrid',
        { dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'DateFrom is required.' },
            id: 13
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('required');
    });

    test('returns 401 when authorization token is missing', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(401, 'Unauthorized');

      const statusCode = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupWorkforceGetPlanningGrid', arguments: { dateFrom: '2026-03-01', dateTo: '2026-03-07' } },
          id: 14
        });

        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
          rejectUnauthorized: false
        }, (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(statusCode).toBe(401);
    });

    test('grid shiftRows contain colorCode and time data for each shift', async () => {
      const response = await call(
        'UteamupWorkforceGetPlanningGrid',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(grid) }] },
            id: 15
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      const shiftRow = result.shiftRows[0];
      expect(shiftRow.shiftColorCode).toBe('#3B82F6');
      expect(shiftRow.startTime).toBe('08:00:00');
      expect(shiftRow.endTime).toBe('16:00:00');
      expect(shiftRow.spansOvernight).toBe(false);
    });

    test('returns 503 when backend is unavailable — no crash', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(503, 'Service Unavailable');

      const statusCode = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupWorkforceGetPlanningGrid', arguments: { dateFrom: '2026-03-01', dateTo: '2026-03-07' } },
          id: 16
        });

        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
          rejectUnauthorized: false
        }, (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(statusCode).toBe(503);
    });

    test('multi-category grid with two category groups returns both in shiftRows', async () => {
      const multiCategoryGrid = {
        ...grid,
        shiftRows: [
          {
            ...grid.shiftRows[0],
            categoryGroups: [
              { categoryGuid: guid(1), categoryName: 'Electrical Day', categoryColorCode: '#3B82F6', assignmentsByDate: { '2026-03-01': [], '2026-03-02': [] } },
              { categoryGuid: guid(2), categoryName: 'Plumbing Night', categoryColorCode: '#10B981', assignmentsByDate: { '2026-03-01': [], '2026-03-02': [] } }
            ]
          }
        ]
      };

      const response = await call(
        'UteamupWorkforceGetPlanningGrid',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07', categoryGuids: [guid(1), guid(2)] },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(multiCategoryGrid) }] },
            id: 17
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.shiftRows[0].categoryGroups.length).toBe(2);
      expect(result.shiftRows[0].categoryGroups[0].categoryGuid).toBe(guid(1));
      expect(result.shiftRows[0].categoryGroups[1].categoryGuid).toBe(guid(2));
    });
  });

  // ---------------------------------------------------------------------------
  // Standalone: request envelope test
  // ---------------------------------------------------------------------------
    test('request to /mcp includes jsonrpc 2.0 envelope with method tools/call', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => { capturedBody = body; return true; })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [] },
          id: 102
        }), { 'Content-Type': 'application/json' });

      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'UteamupWorkforceGetPlanningGrid', arguments: { dateFrom: '2026-03-01', dateTo: '2026-03-07' } },
        id: 102
      };

      await new Promise((resolve, reject) => {
        const data = JSON.stringify(request);
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
          rejectUnauthorized: false
        }, (res) => {
          res.on('data', () => {});
          res.on('end', resolve);
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(capturedBody.jsonrpc).toBe('2.0');
      expect(capturedBody.method).toBe('tools/call');
      expect(capturedBody.params).toBeDefined();
      expect(capturedBody.id).toBeDefined();
    });

  // ---------------------------------------------------------------------------
  // Shared error-handling tests (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupWorkforceGetPlanningGrid', args: { dateFrom: '2026-03-01', dateTo: '2026-03-07' } },
    { name: 'UteamupWorkforceGetGroupMembers', args: { groupGuid: guid(5) } },
    {
      name: 'UteamupWorkforceAssignWorkOrder',
      args: { workOrderGuid: guid(42), assigneeUserGuid: guid(201) }
    }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
  // ---------------------------------------------------------------------------
  // Permission denied handling
  // ---------------------------------------------------------------------------
  describe('Permission denied handling', () => {
    test('GetPlanningGrid returns permission error when ShiftInstance.Read is missing', async () => {
      const response = await call(
        'UteamupWorkforceGetPlanningGrid',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: ShiftInstance.Read required' },
            id: 110
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32600);
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('ShiftInstance.Read');
      expect(response.body.result).toBeUndefined();
    });

  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceGetGroupMembers — per-member rows
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceGetGroupMembers', () => {
    const groupMembers = [
      {
        guid: guid(1),
        workforceGroupGuid: guid(5),
        userGuid: guid(201),
        userName: 'Erik Larsson',
        userEmail: 'erik@example.com',
        userAvatarUrl: null,
        teamGuid: null,
        teamName: null,
        role: 0,
        isActive: true
      },
      {
        guid: guid(2),
        workforceGroupGuid: guid(5),
        userGuid: guid(202),
        userName: 'Sofia Andersson',
        userEmail: 'sofia@example.com',
        userAvatarUrl: 'https://example.com/sofia.jpg',
        teamGuid: guid(3),
        teamName: 'Team Alpha',
        role: 1,
        isActive: true
      }
    ];

    test('returns group members with user details', async () => {
      const response = await call(
        'UteamupWorkforceGetGroupMembers',
        { groupGuid: guid(5) },
        {
          status: 200,
          body: { jsonrpc: '2.0', result: { content: [{ type: 'text', text: JSON.stringify(groupMembers) }] }, id: 200 }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBeDefined();

      const members = JSON.parse(response.body.result.content[0].text);
      expect(members).toHaveLength(2);
      expect(members[0].userGuid).toBe(guid(201));
      expect(members[0].userName).toBe('Erik Larsson');
      expect(members[1].userGuid).toBe(guid(202));
      expect(members[1].role).toBe(1); // Lead
    });

    test('returns empty array for group with no members', async () => {
      const response = await call(
        'UteamupWorkforceGetGroupMembers',
        { groupGuid: guid(99) },
        {
          status: 200,
          body: { jsonrpc: '2.0', result: { content: [{ type: 'text', text: '[]' }] }, id: 201 }
        }
      );

      expect(response.status).toBe(200);
      const members = JSON.parse(response.body.result.content[0].text);
      expect(members).toEqual([]);
    });

    test('returns permission error when Schedule.Manage is missing', async () => {
      const response = await call(
        'UteamupWorkforceGetGroupMembers',
        { groupGuid: guid(5) },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: Schedule.Manage required' },
            id: 202
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32600);
      expect(response.body.error.message).toContain('Schedule.Manage');
      expect(response.body.result).toBeUndefined();
    });

    test('captures groupGuid parameter in request', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', body => {
          capturedBody = body;
          return body.method === 'tools/call' && body.params?.name === 'UteamupWorkforceGetGroupMembers';
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '[]' }] },
          id: 203
        }), { 'Content-Type': 'application/json' });

      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'UteamupWorkforceGetGroupMembers', arguments: { groupGuid: guid(7) } },
        id: 203
      };

      await new Promise((resolve, reject) => {
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
          res.on('end', () => resolve(JSON.parse(responseData)));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(capturedBody).toBeTruthy();
      expect(capturedBody.params.arguments.groupGuid).toBe(guid(7));
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceAssignWorkOrder — drag-and-drop assignment
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceAssignWorkOrder', () => {
    const assignedWorkOrderReference = {
      entityGuid: guid(42),
      entityType: 'Workorder',
      name: 'Replace HVAC filter',
      route: `/workorders/${guid(42)}`,
      dataFreshAtUtc: '2026-03-01T12:00:00Z'
    };

    test('assigns work order to member and returns updated work order', async () => {
      const response = await call(
        'UteamupWorkforceAssignWorkOrder',
        { workOrderGuid: guid(42), assigneeUserGuid: guid(201) },
        {
          status: 200,
          body: { jsonrpc: '2.0', result: { content: [{ type: 'text', text: JSON.stringify(assignedWorkOrderReference) }] }, id: 300 }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const reference = JSON.parse(response.body.result.content[0].text);
      expect(reference.entityGuid).toBe(guid(42));
      expect(reference.entityType).toBe('Workorder');
      expect(reference.route).toBe(`/workorders/${guid(42)}`);
    });

    test('returns permission error when WorkOrder.Update is missing', async () => {
      const response = await call(
        'UteamupWorkforceAssignWorkOrder',
        { workOrderGuid: guid(42), assigneeUserGuid: guid(201) },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: WorkOrder.Update required' },
            id: 301
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32600);
      expect(response.body.error.message).toContain('WorkOrder.Update');
      expect(response.body.result).toBeUndefined();
    });

    test('captures workOrderGuid and assigneeUserGuid parameters', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', body => {
          capturedBody = body;
          return body.method === 'tools/call' && body.params?.name === 'UteamupWorkforceAssignWorkOrder';
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(assignedWorkOrderReference) }] },
          id: 302
        }), { 'Content-Type': 'application/json' });

      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'UteamupWorkforceAssignWorkOrder', arguments: { workOrderGuid: guid(42), assigneeUserGuid: guid(201) } },
        id: 302
      };

      await new Promise((resolve, reject) => {
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
          res.on('end', () => resolve(JSON.parse(responseData)));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(capturedBody).toBeTruthy();
      expect(capturedBody.params.arguments.workOrderGuid).toBe(guid(42));
      expect(capturedBody.params.arguments.assigneeUserGuid).toBe(guid(201));
    });

    test('returns error for non-existent work order', async () => {
      const response = await call(
        'UteamupWorkforceAssignWorkOrder',
        { workOrderGuid: guid(999999), assigneeUserGuid: guid(201) },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Work order not found' },
            id: 303
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32603);
      expect(response.body.result).toBeUndefined();
    });
  });
});
