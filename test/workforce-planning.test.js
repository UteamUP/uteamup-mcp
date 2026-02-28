/**
 * Workforce Planning MCP tool tests
 *
 * Tests that WorkforcePlanning MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error
 * responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   UteamupWorkforcePlanningGetGrid        — get the planning grid for a date range
 *   UteamupWorkforcePlanningGetWorkOrders  — get work orders panel for a date range
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
        shiftId: 1,
        shiftName: 'Morning Shift',
        shiftColorCode: '#3B82F6',
        startTime: '08:00:00',
        endTime: '16:00:00',
        spansOvernight: false,
        categoryGroups: [
          {
            categoryId: 1,
            categoryName: 'Electrical Day',
            categoryColorCode: '#3B82F6',
            assignmentsByDate: {
              '2026-03-01': [{ assignmentId: 10, userId: 'user-1', userName: 'Alice', status: 'Assigned' }],
              '2026-03-02': []
            }
          }
        ],
        instancesByDate: {
          '2026-03-01': { instanceId: 5, instanceDate: '2026-03-01T00:00:00Z', status: 'Published', isHoliday: false, assignedCount: 1, workOrderCount: 2 },
          '2026-03-02': null
        }
      }
    ],
    totalWorkOrders: 5,
    unassignedWorkOrders: 2
  };

  const workOrdersPanel = {
    dateFrom: '2026-03-01T00:00:00Z',
    dateTo: '2026-03-07T00:00:00Z',
    scheduled: [
      { workOrderId: 100, title: 'Fix HVAC', priority: '2', assignedUserId: 'user-1', scheduledDate: '2026-03-01T00:00:00Z', isOverdue: false }
    ],
    overdue: [
      { workOrderId: 95, title: 'Replace Filter', priority: '1', scheduledDate: '2026-02-15T00:00:00Z', isOverdue: true }
    ],
    unassigned: [
      { workOrderId: 102, title: 'Inspect Pump', priority: '3', scheduledDate: '2026-03-03T00:00:00Z', isOverdue: false }
    ]
  };

  // ---------------------------------------------------------------------------
  // UteamupWorkforcePlanningGetGrid
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforcePlanningGetGrid tool', () => {
    test('returns grid with shiftRows for valid date range', async () => {
      const response = await call(
        'UteamupWorkforcePlanningGetGrid',
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
        'UteamupWorkforcePlanningGetGrid',
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
        'UteamupWorkforcePlanningGetGrid',
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

    test('categoryIds filter returns filtered grid with only matching category groups', async () => {
      const filteredGrid = {
        ...grid,
        shiftRows: [
          {
            ...grid.shiftRows[0],
            categoryGroups: grid.shiftRows[0].categoryGroups.filter(cg => cg.categoryId === 1)
          }
        ]
      };

      const response = await call(
        'UteamupWorkforcePlanningGetGrid',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07', categoryIds: [1] },
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
      expect(result.shiftRows[0].categoryGroups[0].categoryId).toBe(1);
    });

    test('returns empty shiftRows array when no shifts are configured', async () => {
      const emptyGrid = {
        ...grid,
        shiftRows: [],
        totalWorkOrders: 0,
        unassignedWorkOrders: 0
      };

      const response = await call(
        'UteamupWorkforcePlanningGetGrid',
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
        'UteamupWorkforcePlanningGetGrid',
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
      expect(categoryGroup.assignmentsByDate['2026-03-01'][0].userId).toBe('user-1');
      expect(categoryGroup.assignmentsByDate['2026-03-01'][0].userName).toBe('Alice');
    });

    test('instancesByDate includes workOrderCount and assignedCount for published instances', async () => {
      const response = await call(
        'UteamupWorkforcePlanningGetGrid',
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
      expect(instanceOnMarch1.instanceId).toBe(5);
      expect(instanceOnMarch1.workOrderCount).toBe(2);
      expect(instanceOnMarch1.assignedCount).toBe(1);
      expect(instanceOnMarch1.status).toBe('Published');
    });

    test('returns permission error when WorkforcePlanning.Read is missing', async () => {
      const response = await call(
        'UteamupWorkforcePlanningGetGrid',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: WorkforcePlanning.Read required' },
            id: 8
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('WorkforcePlanning.Read');
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const response = await call(
        'UteamupWorkforcePlanningGetGrid',
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
        'UteamupWorkforcePlanningGetGrid',
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

    test('includes dateFrom, dateTo, and optional categoryIds in request params', async () => {
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
          name: 'UteamupWorkforcePlanningGetGrid',
          arguments: { dateFrom: '2026-03-01', dateTo: '2026-03-07', categoryIds: [1, 2] }
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
      expect(capturedBody.params.arguments.categoryIds).toEqual([1, 2]);
    });

    test('instancesByDate is null for dates with no instance', async () => {
      const response = await call(
        'UteamupWorkforcePlanningGetGrid',
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
        'UteamupWorkforcePlanningGetGrid',
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
          params: { name: 'UteamupWorkforcePlanningGetGrid', arguments: { dateFrom: '2026-03-01', dateTo: '2026-03-07' } },
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
        'UteamupWorkforcePlanningGetGrid',
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
          params: { name: 'UteamupWorkforcePlanningGetGrid', arguments: { dateFrom: '2026-03-01', dateTo: '2026-03-07' } },
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
              { categoryId: 1, categoryName: 'Electrical Day', categoryColorCode: '#3B82F6', assignmentsByDate: { '2026-03-01': [], '2026-03-02': [] } },
              { categoryId: 2, categoryName: 'Plumbing Night', categoryColorCode: '#10B981', assignmentsByDate: { '2026-03-01': [], '2026-03-02': [] } }
            ]
          }
        ]
      };

      const response = await call(
        'UteamupWorkforcePlanningGetGrid',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07', categoryIds: [1, 2] },
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
      expect(result.shiftRows[0].categoryGroups[0].categoryId).toBe(1);
      expect(result.shiftRows[0].categoryGroups[1].categoryId).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforcePlanningGetWorkOrders
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforcePlanningGetWorkOrders tool', () => {
    test('returns scheduled, overdue, and unassigned work order lists', async () => {
      const response = await call(
        'UteamupWorkforcePlanningGetWorkOrders',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(workOrdersPanel) }] },
            id: 20
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(result.scheduled)).toBe(true);
      expect(Array.isArray(result.overdue)).toBe(true);
      expect(Array.isArray(result.unassigned)).toBe(true);
      expect(result.scheduled.length).toBe(1);
      expect(result.overdue.length).toBe(1);
      expect(result.unassigned.length).toBe(1);
    });

    test('overdue items have isOverdue: true with past scheduledDate', async () => {
      const response = await call(
        'UteamupWorkforcePlanningGetWorkOrders',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(workOrdersPanel) }] },
            id: 21
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.overdue.length).toBeGreaterThan(0);
      result.overdue.forEach(wo => {
        expect(wo.isOverdue).toBe(true);
      });
      expect(result.overdue[0].scheduledDate).toBe('2026-02-15T00:00:00Z');
    });

    test('scheduled items have assignedUserId set', async () => {
      const response = await call(
        'UteamupWorkforcePlanningGetWorkOrders',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(workOrdersPanel) }] },
            id: 22
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.scheduled.length).toBeGreaterThan(0);
      result.scheduled.forEach(wo => {
        expect(wo.assignedUserId).toBeDefined();
        expect(wo.assignedUserId).not.toBeNull();
      });
      expect(result.scheduled[0].workOrderId).toBe(100);
      expect(result.scheduled[0].title).toBe('Fix HVAC');
    });

    test('returns empty scheduled list when no work orders are in the range', async () => {
      const emptyScheduled = { ...workOrdersPanel, scheduled: [], overdue: [], unassigned: [] };

      const response = await call(
        'UteamupWorkforcePlanningGetWorkOrders',
        { dateFrom: '2026-04-01', dateTo: '2026-04-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(emptyScheduled) }] },
            id: 23
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.scheduled.length).toBe(0);
      expect(result.overdue.length).toBe(0);
      expect(result.unassigned.length).toBe(0);
    });

    test('overdue work orders have scheduledDate in the past', async () => {
      const overdueWOs = {
        ...workOrdersPanel,
        overdue: [
          { workOrderId: 95, title: 'Replace Filter', priority: '1', scheduledDate: '2026-02-15T00:00:00Z', isOverdue: true },
          { workOrderId: 80, title: 'Lubricate Motors', priority: '2', scheduledDate: '2026-01-20T00:00:00Z', isOverdue: true }
        ]
      };

      const response = await call(
        'UteamupWorkforcePlanningGetWorkOrders',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(overdueWOs) }] },
            id: 24
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      result.overdue.forEach(wo => {
        const scheduledDate = new Date(wo.scheduledDate);
        const dateFrom = new Date('2026-03-01');
        expect(scheduledDate < dateFrom).toBe(true);
      });
    });

    test('returns permission error when WorkforcePlanning.Read is missing', async () => {
      const response = await call(
        'UteamupWorkforcePlanningGetWorkOrders',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: WorkforcePlanning.Read required' },
            id: 25
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('WorkforcePlanning.Read');
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const response = await call(
        'UteamupWorkforcePlanningGetWorkOrders',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(workOrdersPanel) }] },
            id: 26
          }
        }
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(26);
    });

    test('all three tabs (scheduled, overdue, unassigned) are present even when empty', async () => {
      const allEmptyPanel = { ...workOrdersPanel, scheduled: [], overdue: [], unassigned: [] };

      const response = await call(
        'UteamupWorkforcePlanningGetWorkOrders',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(allEmptyPanel) }] },
            id: 27
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect('scheduled' in result).toBe(true);
      expect('overdue' in result).toBe(true);
      expect('unassigned' in result).toBe(true);
      expect(Array.isArray(result.scheduled)).toBe(true);
      expect(Array.isArray(result.overdue)).toBe(true);
      expect(Array.isArray(result.unassigned)).toBe(true);
    });

    test('includes dateFrom and dateTo in request params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => { capturedBody = body; return true; })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(workOrdersPanel) }] },
          id: 28
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupWorkforcePlanningGetWorkOrders',
          arguments: { dateFrom: '2026-03-01', dateTo: '2026-03-07' }
        },
        id: 28
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
    });

    test('unassigned work orders do not have assignedUserId set', async () => {
      const withUnassigned = {
        ...workOrdersPanel,
        unassigned: [
          { workOrderId: 102, title: 'Inspect Pump', priority: '3', scheduledDate: '2026-03-03T00:00:00Z', isOverdue: false },
          { workOrderId: 103, title: 'Check Valve', priority: '2', scheduledDate: '2026-03-04T00:00:00Z', isOverdue: false }
        ]
      };

      const response = await call(
        'UteamupWorkforcePlanningGetWorkOrders',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(withUnassigned) }] },
            id: 29
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.unassigned.length).toBe(2);
      result.unassigned.forEach(wo => {
        expect(wo.assignedUserId).toBeUndefined();
        expect(wo.isOverdue).toBe(false);
      });
    });

    test('returns 401 when authorization token is missing', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(401, 'Unauthorized');

      const statusCode = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupWorkforcePlanningGetWorkOrders', arguments: { dateFrom: '2026-03-01', dateTo: '2026-03-07' } },
          id: 30
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

    test('response includes dateFrom and dateTo fields matching the query range', async () => {
      const response = await call(
        'UteamupWorkforcePlanningGetWorkOrders',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(workOrdersPanel) }] },
            id: 31
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.dateFrom).toBe('2026-03-01T00:00:00Z');
      expect(result.dateTo).toBe('2026-03-07T00:00:00Z');
    });

    test('multiple scheduled work orders returned in correct order with required fields', async () => {
      const multiScheduled = {
        ...workOrdersPanel,
        scheduled: [
          { workOrderId: 100, title: 'Fix HVAC', priority: '2', assignedUserId: 'user-1', scheduledDate: '2026-03-01T00:00:00Z', isOverdue: false },
          { workOrderId: 101, title: 'Repair Boiler', priority: '1', assignedUserId: 'user-2', scheduledDate: '2026-03-02T00:00:00Z', isOverdue: false },
          { workOrderId: 104, title: 'Test Fire Suppression', priority: '3', assignedUserId: 'user-3', scheduledDate: '2026-03-05T00:00:00Z', isOverdue: false }
        ]
      };

      const response = await call(
        'UteamupWorkforcePlanningGetWorkOrders',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(multiScheduled) }] },
            id: 32
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.scheduled.length).toBe(3);
      result.scheduled.forEach(wo => {
        expect(wo.workOrderId).toBeDefined();
        expect(wo.title).toBeDefined();
        expect(wo.priority).toBeDefined();
        expect(wo.assignedUserId).toBeDefined();
        expect(wo.scheduledDate).toBeDefined();
        expect(wo.isOverdue).toBe(false);
      });
    });

    test('returns 503 when backend is unavailable — no crash', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(503, 'Service Unavailable');

      const statusCode = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupWorkforcePlanningGetWorkOrders', arguments: { dateFrom: '2026-03-01', dateTo: '2026-03-07' } },
          id: 33
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
        params: { name: 'UteamupWorkforcePlanningGetGrid', arguments: { dateFrom: '2026-03-01', dateTo: '2026-03-07' } },
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
    { name: 'UteamupWorkforcePlanningGetGrid', args: { dateFrom: '2026-03-01', dateTo: '2026-03-07' } },
    { name: 'UteamupWorkforcePlanningGetWorkOrders', args: { dateFrom: '2026-03-01', dateTo: '2026-03-07' } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
  // ---------------------------------------------------------------------------
  // Permission denied handling — both tools
  // ---------------------------------------------------------------------------
  describe('Permission denied handling', () => {
    test('GetGrid returns permission error when WorkforcePlanning.Read is missing', async () => {
      const response = await call(
        'UteamupWorkforcePlanningGetGrid',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: WorkforcePlanning.Read required' },
            id: 110
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32600);
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('WorkforcePlanning.Read');
      expect(response.body.result).toBeUndefined();
    });

    test('GetWorkOrders returns permission error when WorkforcePlanning.Read is missing', async () => {
      const response = await call(
        'UteamupWorkforcePlanningGetWorkOrders',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: WorkforcePlanning.Read required' },
            id: 111
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32600);
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.result).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceGetGroupMembers — per-member rows
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceGetGroupMembers', () => {
    const groupMembers = [
      {
        id: 1,
        workforceGroupId: 5,
        userId: 'user-abc-123',
        userName: 'Erik Larsson',
        userEmail: 'erik@example.com',
        userAvatarUrl: null,
        teamId: null,
        teamName: null,
        role: 0,
        isActive: true
      },
      {
        id: 2,
        workforceGroupId: 5,
        userId: 'user-def-456',
        userName: 'Sofia Andersson',
        userEmail: 'sofia@example.com',
        userAvatarUrl: 'https://example.com/sofia.jpg',
        teamId: 3,
        teamName: 'Team Alpha',
        role: 1,
        isActive: true
      }
    ];

    test('returns group members with user details', async () => {
      const response = await call(
        'UteamupWorkforceGetGroupMembers',
        { groupId: 5 },
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
      expect(members[0].userId).toBe('user-abc-123');
      expect(members[0].userName).toBe('Erik Larsson');
      expect(members[1].userId).toBe('user-def-456');
      expect(members[1].role).toBe(1); // Lead
    });

    test('returns empty array for group with no members', async () => {
      const response = await call(
        'UteamupWorkforceGetGroupMembers',
        { groupId: 99 },
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
        { groupId: 5 },
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

    test('captures groupId parameter in request', async () => {
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
        params: { name: 'UteamupWorkforceGetGroupMembers', arguments: { groupId: 7 } },
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
      expect(capturedBody.params.arguments.groupId).toBe(7);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceAssignWorkOrder — drag-and-drop assignment
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceAssignWorkOrder', () => {
    const assignedWorkOrder = {
      id: 42,
      title: 'Replace HVAC filter',
      primaryAssigneeId: 'user-abc-123',
      primaryAssigneeName: 'Erik Larsson',
      status: 1
    };

    test('assigns work order to member and returns updated work order', async () => {
      const response = await call(
        'UteamupWorkforceAssignWorkOrder',
        { workOrderId: 42, assigneeUserId: 'user-abc-123' },
        {
          status: 200,
          body: { jsonrpc: '2.0', result: { content: [{ type: 'text', text: JSON.stringify(assignedWorkOrder) }] }, id: 300 }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const wo = JSON.parse(response.body.result.content[0].text);
      expect(wo.id).toBe(42);
      expect(wo.primaryAssigneeId).toBe('user-abc-123');
    });

    test('returns permission error when WorkOrder.Update is missing', async () => {
      const response = await call(
        'UteamupWorkforceAssignWorkOrder',
        { workOrderId: 42, assigneeUserId: 'user-abc-123' },
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

    test('captures workOrderId and assigneeUserId parameters', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', body => {
          capturedBody = body;
          return body.method === 'tools/call' && body.params?.name === 'UteamupWorkforceAssignWorkOrder';
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(assignedWorkOrder) }] },
          id: 302
        }), { 'Content-Type': 'application/json' });

      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'UteamupWorkforceAssignWorkOrder', arguments: { workOrderId: 42, assigneeUserId: 'user-abc-123' } },
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
      expect(capturedBody.params.arguments.workOrderId).toBe(42);
      expect(capturedBody.params.arguments.assigneeUserId).toBe('user-abc-123');
    });

    test('returns error for non-existent work order', async () => {
      const response = await call(
        'UteamupWorkforceAssignWorkOrder',
        { workOrderId: 999999, assigneeUserId: 'user-abc-123' },
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
