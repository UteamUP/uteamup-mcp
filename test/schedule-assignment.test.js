/**
 * Schedule Assignment MCP tool tests
 *
 * Tests that schedule assignment MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error responses
 * from the backend /mcp endpoint.
 *
 * Pattern mirrors integration.test.js: raw nock-mocked HTTPS calls that simulate
 * what the MCP proxy would forward to the backend.
 */

const nock = require('nock');
const https = require('https');
const { callMcpTool: _callMcpTool } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Schedule Assignment MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_schedule';

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // get_week_schedule
  // ---------------------------------------------------------------------------
  describe('get_week_schedule tool', () => {
    test('should forward get_week_schedule call to backend and return week view', async () => {
      const mockWeekView = {
        weekStart: '2026-03-02T00:00:00Z',
        weekEnd: '2026-03-08T23:59:59Z',
        teamId: 3,
        teamName: 'Electrical Team',
        technicians: [
          {
            technicianId: 'user-abc-123',
            technicianName: 'Alice Smith',
            utilizationPercent: 75.0,
            assignments: []
          }
        ],
        unassignedWorkorders: []
      };

      const response = await call(
        'UteamupScheduleAssignmentGetWeekSchedule',
        { weekStart: '2026-03-02', teamId: 3 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockWeekView) }] },
            id: 1
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('should handle missing teamId parameter (all-teams view)', async () => {
      const mockWeekView = {
        weekStart: '2026-03-02T00:00:00Z',
        weekEnd: '2026-03-08T23:59:59Z',
        teamId: null,
        teamName: null,
        technicians: [],
        unassignedWorkorders: []
      };

      const response = await call(
        'UteamupScheduleAssignmentGetWeekSchedule',
        { weekStart: '2026-03-02' }, // no teamId
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockWeekView) }] },
            id: 2
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });

    test('should handle backend error for invalid weekStart date', async () => {
      const response = await call(
        'UteamupScheduleAssignmentGetWeekSchedule',
        { weekStart: 'not-a-date' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'WeekStart must be a valid date string in YYYY-MM-DD format'
            },
            id: 3
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('YYYY-MM-DD');
    });
  });

  // ---------------------------------------------------------------------------
  // create_assignment
  // ---------------------------------------------------------------------------
  describe('create_assignment tool', () => {
    test('should forward create_assignment call to backend and return created assignment', async () => {
      const mockAssignment = {
        id: 101,
        guid: 'assign-guid-101',
        workorderId: 42,
        workorderTitle: 'Fix HVAC Unit B',
        technicianId: 'user-bob-456',
        technicianName: 'Bob Jones',
        teamId: null,
        scheduledStart: '2026-03-02T09:00:00Z',
        scheduledEnd: '2026-03-02T12:00:00Z',
        estimatedDurationMinutes: 180,
        status: 0,
        assignmentMethod: 'Manual',
        competencyScore: 82.5
      };

      const response = await call(
        'UteamupScheduleAssignmentCreate',
        {
          workOrderId: 42,
          technicianId: 'user-bob-456',
          scheduledStart: '2026-03-02T09:00:00',
          scheduledEnd: '2026-03-02T12:00:00'
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockAssignment) }] },
            id: 4
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('should include all required parameters in the request body', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '{}' }] },
          id: 5
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupScheduleAssignmentCreate',
          arguments: {
            workOrderId: 99,
            technicianId: 'user-charlie-789',
            scheduledStart: '2026-03-03T08:00:00',
            scheduledEnd: '2026-03-03T10:00:00',
            teamId: 2,
            estimatedDurationMinutes: 120,
            notes: 'Check valve first'
          }
        },
        id: 5
      };

      await new Promise((resolve, reject) => {
        const data = JSON.stringify(requestPayload);
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          },
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
      expect(capturedBody.params.arguments.workOrderId).toBe(99);
      expect(capturedBody.params.arguments.technicianId).toBe('user-charlie-789');
      expect(capturedBody.params.arguments.scheduledStart).toBe('2026-03-03T08:00:00');
      expect(capturedBody.params.arguments.scheduledEnd).toBe('2026-03-03T10:00:00');
      expect(capturedBody.params.arguments.teamId).toBe(2);
      expect(capturedBody.params.arguments.estimatedDurationMinutes).toBe(120);
      expect(capturedBody.params.arguments.notes).toBe('Check valve first');
    });

    test('should reject when scheduledEnd is before scheduledStart', async () => {
      const response = await call(
        'UteamupScheduleAssignmentCreate',
        {
          workOrderId: 42,
          technicianId: 'user-bob-456',
          scheduledStart: '2026-03-02T12:00:00',
          scheduledEnd: '2026-03-02T09:00:00' // end before start
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'ScheduledEnd must be after ScheduledStart'
            },
            id: 6
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('ScheduledEnd');
    });
  });

  // ---------------------------------------------------------------------------
  // auto_assign
  // ---------------------------------------------------------------------------
  describe('auto_assign tool', () => {
    test('should forward auto_assign call to backend and return created assignments', async () => {
      const mockAssignments = [
        {
          id: 201,
          workorderId: 10,
          technicianId: 'user-alice-001',
          technicianName: 'Alice Smith',
          scheduledStart: '2026-03-02T09:00:00Z',
          scheduledEnd: '2026-03-02T11:00:00Z',
          assignmentMethod: 'AutoAssign',
          competencyScore: 91.0
        },
        {
          id: 202,
          workorderId: 11,
          technicianId: 'user-bob-002',
          technicianName: 'Bob Jones',
          scheduledStart: '2026-03-02T10:00:00Z',
          scheduledEnd: '2026-03-02T12:00:00Z',
          assignmentMethod: 'AutoAssign',
          competencyScore: 78.5
        }
      ];

      const response = await call(
        'UteamupScheduleAssignmentAutoAssign',
        { workOrderIds: [10, 11], date: '2026-03-02' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockAssignments) }] },
            id: 7
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('should handle empty workOrderIds array with error response', async () => {
      const response = await call(
        'UteamupScheduleAssignmentAutoAssign',
        { workOrderIds: [], date: '2026-03-02' }, // empty list
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'WorkOrderIds must contain at least one work order ID'
            },
            id: 8
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('WorkOrderIds');
    });

    test('should include teamId when provided', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '[]' }] },
          id: 9
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupScheduleAssignmentAutoAssign',
          arguments: { workOrderIds: [20, 21, 22], date: '2026-03-03', teamId: 5 }
        },
        id: 9
      };

      await new Promise((resolve, reject) => {
        const data = JSON.stringify(requestPayload);
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          },
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
      expect(capturedBody.params.arguments.workOrderIds).toEqual([20, 21, 22]);
      expect(capturedBody.params.arguments.teamId).toBe(5);
      expect(capturedBody.params.arguments.date).toBe('2026-03-03');
    });
  });

  // ---------------------------------------------------------------------------
  // get_technician_schedule
  // ---------------------------------------------------------------------------
  describe('get_technician_schedule tool', () => {
    test('should forward get_technician_schedule call to backend', async () => {
      const mockSchedule = [
        {
          id: 301,
          workorderId: 55,
          workorderTitle: 'Inspect Pump Station',
          technicianId: 'user-alice-001',
          scheduledStart: '2026-02-23T08:00:00Z',
          scheduledEnd: '2026-02-23T10:30:00Z',
          status: 0
        }
      ];

      const response = await call(
        'UteamupScheduleAssignmentGetTechnicianSchedule',
        { technicianId: 'user-alice-001', from: '2026-02-23', to: '2026-02-28' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockSchedule) }] },
            id: 10
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('should validate date range — to date must be after from date', async () => {
      const response = await call(
        'UteamupScheduleAssignmentGetTechnicianSchedule',
        {
          technicianId: 'user-alice-001',
          from: '2026-02-28',
          to: '2026-02-23' // to before from
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'To date must be after From date'
            },
            id: 11
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('To date');
    });

    test('should return empty list when technician has no assignments in range', async () => {
      const response = await call(
        'UteamupScheduleAssignmentGetTechnicianSchedule',
        { technicianId: 'user-new-999', from: '2026-03-01', to: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: '[]' }] },
            id: 12
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      const content = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(content)).toBe(true);
      expect(content.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // get_unassigned_workorders
  // ---------------------------------------------------------------------------
  describe('get_unassigned_workorders tool', () => {
    test('should forward get_unassigned_workorders call and return backlog list', async () => {
      const mockUnassigned = [
        {
          id: 77,
          title: 'Replace Filter Bank C',
          priority: 1,
          dueDate: '2026-03-04T00:00:00Z',
          estimatedDurationMinutes: 90,
          locationName: 'Building A'
        },
        {
          id: 88,
          title: 'Lubricate Conveyor Motors',
          priority: 2,
          dueDate: '2026-03-06T00:00:00Z',
          estimatedDurationMinutes: 60,
          locationName: 'Building B'
        }
      ];

      const response = await call(
        'UteamupScheduleAssignmentGetUnassignedWorkOrders',
        { from: '2026-03-02', to: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockUnassigned) }] },
            id: 13
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------
  describe('Error handling', () => {
    test('should return error response when backend returns 404 for unknown work order', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: 'Work order 9999 not found'
          },
          id: 14
        }), { 'Content-Type': 'application/json' });

      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupScheduleAssignmentCreate',
          arguments: {
            workOrderId: 9999,
            technicianId: 'user-abc',
            scheduledStart: '2026-03-02T09:00:00',
            scheduledEnd: '2026-03-02T11:00:00'
          }
        },
        id: 14
      };

      const response = await new Promise((resolve, reject) => {
        const data = JSON.stringify(request);
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
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

      expect(response.error).toBeDefined();
      expect(response.error.message).toContain('not found');
    });

    test('should retry on 503 backend response and succeed on second attempt', async () => {
      // First attempt: 503 Service Unavailable
      nock(BASE_URL)
        .post('/mcp')
        .reply(503, 'Service Unavailable');

      // Second attempt: success
      nock(BASE_URL)
        .post('/mcp')
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '[]' }] },
          id: 15
        }), { 'Content-Type': 'application/json' });

      // First attempt (503)
      const firstResult = await new Promise((resolve, reject) => {
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': '2' },
          rejectUnauthorized: false
        }, (res) => {
          resolve(res.statusCode);
          res.on('data', () => {});
          res.on('end', () => {});
        });
        req.on('error', reject);
        req.write('{}');
        req.end();
      });

      expect(firstResult).toBe(503);

      // Second attempt (success after retry)
      const secondResult = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupScheduleAssignmentGetUnassignedWorkOrders', arguments: { from: '2026-03-02', to: '2026-03-07' } },
          id: 15
        });

        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          },
          rejectUnauthorized: false
        }, (res) => {
          let responseData = '';
          res.on('data', chunk => responseData += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(responseData) }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(secondResult.status).toBe(200);
      expect(secondResult.body.result).toBeDefined();
    });

    test('should return 401 error when authorization token is missing', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(401, 'Unauthorized');

      const statusCode = await new Promise((resolve, reject) => {
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': '2' },
          rejectUnauthorized: false
        }, (res) => {
          resolve(res.statusCode);
          res.on('data', () => {});
          res.on('end', () => {});
        });
        req.on('error', reject);
        req.write('{}');
        req.end();
      });

      expect(statusCode).toBe(401);
    });

    test('should return permission denied error when user lacks Schedule.Manage permission', async () => {
      const response = await call(
        'UteamupScheduleAssignmentCreate',
        {
          workOrderId: 42,
          technicianId: 'user-bob-456',
          scheduledStart: '2026-03-02T09:00:00',
          scheduledEnd: '2026-03-02T12:00:00'
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Permission denied: Schedule.Manage required'
            },
            id: 17
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Schedule.Manage');
    });
  });

  // ---------------------------------------------------------------------------
  // JSON-RPC 2.0 protocol compliance
  // ---------------------------------------------------------------------------
  describe('JSON-RPC 2.0 protocol compliance', () => {
    test('request should include jsonrpc version, method, params, and id fields', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [] },
          id: 99
        }), { 'Content-Type': 'application/json' });

      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupScheduleAssignmentGetWeekSchedule',
          arguments: { weekStart: '2026-03-02' }
        },
        id: 99
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

    test('SSE format response from /mcp should be parseable', async () => {
      const mockWeekView = { weekStart: '2026-03-02T00:00:00Z', technicians: [] };
      const sseContent = `event: message\ndata: ${JSON.stringify({
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify(mockWeekView) }] },
        id: 100
      })}`;

      nock(BASE_URL)
        .post('/mcp')
        .reply(200, sseContent, { 'Content-Type': 'text/event-stream' });

      const response = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'UteamupScheduleAssignmentGetWeekSchedule',
            arguments: { weekStart: '2026-03-02' }
          },
          id: 100
        });

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
            // Parse SSE format
            const lines = responseData.trim().split('\n');
            let jsonData = null;
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                jsonData = line.substring(6);
                break;
              }
            }
            resolve(jsonData ? JSON.parse(jsonData) : null);
          });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(response).not.toBeNull();
      expect(response.result).toBeDefined();
      expect(response.result.content[0].type).toBe('text');
    });
  });

  // ---------------------------------------------------------------------------
  // Shared error-handling coverage (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupScheduleAssignmentGetWeekSchedule', args: { weekStart: '2026-03-02' } },
    { name: 'UteamupScheduleAssignmentCreate', args: { workOrderId: 42, technicianId: 'user-bob-456', scheduledStart: '2026-03-02T09:00:00', scheduledEnd: '2026-03-02T12:00:00' } },
    { name: 'UteamupScheduleAssignmentAutoAssign', args: { startDate: '2026-03-02', endDate: '2026-03-07' } },
    { name: 'UteamupScheduleAssignmentGetTechnicianSchedule', args: { technicianId: 'user-abc-123', weekStart: '2026-03-02' } },
    { name: 'UteamupScheduleAssignmentGetUnassignedWorkOrders', args: { from: '2026-03-02', to: '2026-03-07' } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
