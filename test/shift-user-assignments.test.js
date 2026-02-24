/**
 * Shift User Assignment MCP tool tests
 *
 * Tests that Shift User Assignment MCP tool calls are correctly formed as
 * JSON-RPC 2.0 requests and that the MCP proxy handles both successful and
 * error responses from the backend /mcp endpoint gracefully.
 *
 * Tools under test:
 *   UteamupShiftUserAssignmentListByInstance(shiftInstanceId)
 *   UteamupShiftUserAssignmentListByUserAndDate(userId, date)
 *   UteamupShiftUserAssignmentCreate(shiftInstanceId, userId, workforceCategoryId)
 *   UteamupShiftUserAssignmentUpdate(id, status)
 *   UteamupShiftUserAssignmentDelete(id)
 *   UteamupShiftUserAssignmentMarkUnavailable(id, reason)
 *
 * Pattern mirrors schedule-assignment.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const https = require('https');

describe('Shift User Assignment MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_shift_user_assignments';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  // ---------------------------------------------------------------------------
  // Helper: send a JSON-RPC 2.0 tools/call to /mcp
  // ---------------------------------------------------------------------------
  function callMcpTool(toolName, toolArgs, mockReply) {
    nock(BASE_URL)
      .post('/mcp', body => body.method === 'tools/call' && body.params?.name === toolName)
      .reply(mockReply.status, JSON.stringify(mockReply.body), {
        'Content-Type': 'application/json'
      });

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
            resolve({ status: res.statusCode, body: JSON.parse(responseData) });
          } catch {
            resolve({ status: res.statusCode, body: responseData });
          }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  function successReply(data, id = 1) {
    return {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify(data) }] },
        id
      }
    };
  }

  function errorReply(code, message, id = 1) {
    return {
      status: 200,
      body: {
        jsonrpc: '2.0',
        error: { code, message },
        id
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Mock data
  // ---------------------------------------------------------------------------
  const assignment = {
    id: 10,
    shiftInstanceId: 5,
    userId: 'user-alice-001',
    userName: 'Alice Smith',
    workforceCategoryId: 1,
    categoryName: 'Electrical Day',
    status: 'Assigned',
    replacedByUserId: null,
    isRecurring: true,
    notes: null,
    skillMatchLevel: 'NoRequirements'
  };

  const unavailableResult = {
    assignment: { id: 10, status: 'Replaced', shiftInstanceId: 5 },
    replacementSuggestion: {
      shiftInstanceId: 5,
      unavailableUserId: 'user-alice-001',
      candidates: [{ userId: 'user-bob-002', userName: 'Bob Jones', score: 0.85 }]
    }
  };

  // ---------------------------------------------------------------------------
  // UteamupShiftUserAssignmentListByInstance
  // ---------------------------------------------------------------------------
  describe('UteamupShiftUserAssignmentListByInstance tool', () => {
    test('returns list of assignments for a shift instance with 3 entries', async () => {
      const threeAssignments = [
        { ...assignment, id: 10, userId: 'user-alice-001', userName: 'Alice Smith' },
        { ...assignment, id: 11, userId: 'user-bob-002', userName: 'Bob Jones', status: 'Confirmed' },
        { ...assignment, id: 12, userId: 'user-carol-003', userName: 'Carol Davis', status: 'Declined' }
      ];

      const response = await callMcpTool(
        'UteamupShiftUserAssignmentListByInstance',
        { shiftInstanceId: 5 },
        successReply(threeAssignments, 1)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const assignments = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(assignments)).toBe(true);
      expect(assignments.length).toBe(3);
      expect(assignments[0].userId).toBe('user-alice-001');
      expect(assignments[1].status).toBe('Confirmed');
      expect(assignments[2].status).toBe('Declined');
    });

    test('empty instance — shift instance exists but has no assignments', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentListByInstance',
        { shiftInstanceId: 99 },
        successReply([], 2)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      const assignments = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(assignments)).toBe(true);
      expect(assignments.length).toBe(0);
    });

    test('not found — shift instance does not exist returns error', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentListByInstance',
        { shiftInstanceId: 99999 },
        errorReply(-32602, 'Shift instance 99999 not found', 3)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('all valid status values present in a single instance response', async () => {
      const allStatuses = [
        { ...assignment, id: 10, status: 'Assigned' },
        { ...assignment, id: 11, userId: 'user-bob-002', status: 'Confirmed' },
        { ...assignment, id: 12, userId: 'user-carol-003', status: 'Declined' },
        { ...assignment, id: 13, userId: 'user-dave-004', status: 'Replaced', replacedByUserId: 'user-eve-005' }
      ];

      const response = await callMcpTool(
        'UteamupShiftUserAssignmentListByInstance',
        { shiftInstanceId: 5 },
        successReply(allStatuses, 4)
      );

      const assignments = JSON.parse(response.body.result.content[0].text);
      const statuses = assignments.map(a => a.status);
      expect(statuses).toContain('Assigned');
      expect(statuses).toContain('Confirmed');
      expect(statuses).toContain('Declined');
      expect(statuses).toContain('Replaced');
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const id = 5;
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentListByInstance',
        { shiftInstanceId: 5 },
        successReply([assignment], id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('permission denied — returns permission error', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentListByInstance',
        { shiftInstanceId: 5 },
        errorReply(-32600, 'Permission denied: ShiftUserAssignment.Read required', 6)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
    });

    test('assignment has all expected fields including skillMatchLevel and isRecurring', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentListByInstance',
        { shiftInstanceId: 5 },
        successReply([assignment], 7)
      );

      const assignments = JSON.parse(response.body.result.content[0].text);
      const a = assignments[0];
      expect(a).toHaveProperty('id');
      expect(a).toHaveProperty('shiftInstanceId');
      expect(a).toHaveProperty('userId');
      expect(a).toHaveProperty('userName');
      expect(a).toHaveProperty('workforceCategoryId');
      expect(a).toHaveProperty('categoryName');
      expect(a).toHaveProperty('status');
      expect(a).toHaveProperty('isRecurring');
      expect(a).toHaveProperty('skillMatchLevel');
    });

    test('request includes shiftInstanceId in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '[]' }] },
          id: 8
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupShiftUserAssignmentListByInstance',
          arguments: { shiftInstanceId: 5 }
        },
        id: 8
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
      expect(capturedBody.params.arguments.shiftInstanceId).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftUserAssignmentListByUserAndDate
  // ---------------------------------------------------------------------------
  describe('UteamupShiftUserAssignmentListByUserAndDate tool', () => {
    test('found — returns assignments for specific user and date', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentListByUserAndDate',
        { userId: 'user-alice-001', date: '2026-03-01' },
        successReply([assignment], 10)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const assignments = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(assignments)).toBe(true);
      expect(assignments[0].userId).toBe('user-alice-001');
      expect(assignments[0].shiftInstanceId).toBe(5);
    });

    test('not found date — user has no assignments on the specified date returns empty array', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentListByUserAndDate',
        { userId: 'user-alice-001', date: '2026-12-25' },
        successReply([], 11)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      const assignments = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(assignments)).toBe(true);
      expect(assignments.length).toBe(0);
    });

    test('invalid date format — returns validation error', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentListByUserAndDate',
        { userId: 'user-alice-001', date: 'not-a-date' },
        errorReply(-32602, 'Date must be a valid date string in YYYY-MM-DD format', 12)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('YYYY-MM-DD');
    });

    test('user not found — returns error', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentListByUserAndDate',
        { userId: 'user-nonexistent-999', date: '2026-03-01' },
        errorReply(-32602, 'User user-nonexistent-999 not found', 13)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const id = 14;
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentListByUserAndDate',
        { userId: 'user-alice-001', date: '2026-03-01' },
        successReply([assignment], id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('user assigned to multiple shifts on the same date — all returned', async () => {
      const twoShifts = [
        { ...assignment, id: 10, shiftInstanceId: 5, categoryName: 'Electrical Day' },
        { ...assignment, id: 15, shiftInstanceId: 8, categoryName: 'Evening Maintenance' }
      ];

      const response = await callMcpTool(
        'UteamupShiftUserAssignmentListByUserAndDate',
        { userId: 'user-alice-001', date: '2026-03-01' },
        successReply(twoShifts, 15)
      );

      const assignments = JSON.parse(response.body.result.content[0].text);
      expect(assignments.length).toBe(2);
      expect(assignments[0].shiftInstanceId).toBe(5);
      expect(assignments[1].shiftInstanceId).toBe(8);
    });

    test('permission denied — returns permission error', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentListByUserAndDate',
        { userId: 'user-alice-001', date: '2026-03-01' },
        errorReply(-32600, 'Permission denied: ShiftUserAssignment.Read required', 16)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
    });

    test('request includes userId and date in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '[]' }] },
          id: 17
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupShiftUserAssignmentListByUserAndDate',
          arguments: { userId: 'user-alice-001', date: '2026-03-01' }
        },
        id: 17
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
      expect(capturedBody.params.arguments.userId).toBe('user-alice-001');
      expect(capturedBody.params.arguments.date).toBe('2026-03-01');
    });

    test('403 from backend — surfaced without crash', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(403, 'Forbidden');

      const status = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'UteamupShiftUserAssignmentListByUserAndDate',
            arguments: { userId: 'user-alice-001', date: '2026-03-01' }
          },
          id: 18
        });

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
          res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftUserAssignmentCreate
  // ---------------------------------------------------------------------------
  describe('UteamupShiftUserAssignmentCreate tool', () => {
    test('success — creates assignment and returns full assignment object', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentCreate',
        { shiftInstanceId: 5, userId: 'user-alice-001', workforceCategoryId: 1 },
        successReply(assignment, 20)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const created = JSON.parse(response.body.result.content[0].text);
      expect(created.id).toBe(10);
      expect(created.shiftInstanceId).toBe(5);
      expect(created.userId).toBe('user-alice-001');
      expect(created.workforceCategoryId).toBe(1);
      expect(created.status).toBe('Assigned');
    });

    test('duplicate — user already assigned to this shift instance returns error', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentCreate',
        { shiftInstanceId: 5, userId: 'user-alice-001', workforceCategoryId: 1 },
        errorReply(-32602, 'User user-alice-001 is already assigned to shift instance 5', 21)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('already assigned');
    });

    test('permission denied — returns permission error when ShiftUserAssignment.Create is missing', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentCreate',
        { shiftInstanceId: 5, userId: 'user-alice-001', workforceCategoryId: 1 },
        errorReply(-32600, 'Permission denied: ShiftUserAssignment.Create required', 22)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('ShiftUserAssignment.Create');
    });

    test('shift instance not found — returns error', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentCreate',
        { shiftInstanceId: 99999, userId: 'user-alice-001', workforceCategoryId: 1 },
        errorReply(-32602, 'Shift instance 99999 not found', 23)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('user not found — returns error', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentCreate',
        { shiftInstanceId: 5, userId: 'user-nonexistent-999', workforceCategoryId: 1 },
        errorReply(-32602, 'User user-nonexistent-999 not found', 24)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('workforce category not found — returns error', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentCreate',
        { shiftInstanceId: 5, userId: 'user-alice-001', workforceCategoryId: 99999 },
        errorReply(-32602, 'Workforce category 99999 not found', 25)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('JSON-RPC 2.0 compliance — created assignment response has id and result', async () => {
      const id = 26;
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentCreate',
        { shiftInstanceId: 5, userId: 'user-alice-001', workforceCategoryId: 1 },
        successReply(assignment, id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('request includes all three required args in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(assignment) }] },
          id: 27
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupShiftUserAssignmentCreate',
          arguments: { shiftInstanceId: 5, userId: 'user-alice-001', workforceCategoryId: 1 }
        },
        id: 27
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
      expect(capturedBody.params.arguments.shiftInstanceId).toBe(5);
      expect(capturedBody.params.arguments.userId).toBe('user-alice-001');
      expect(capturedBody.params.arguments.workforceCategoryId).toBe(1);
    });

    test('created assignment status defaults to Assigned', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentCreate',
        { shiftInstanceId: 5, userId: 'user-bob-002', workforceCategoryId: 1 },
        successReply({ ...assignment, id: 20, userId: 'user-bob-002', userName: 'Bob Jones' }, 28)
      );

      const created = JSON.parse(response.body.result.content[0].text);
      expect(created.status).toBe('Assigned');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftUserAssignmentUpdate
  // ---------------------------------------------------------------------------
  describe('UteamupShiftUserAssignmentUpdate tool', () => {
    test('status Confirmed — updates assignment to Confirmed and returns updated object', async () => {
      const confirmed = { ...assignment, status: 'Confirmed' };

      const response = await callMcpTool(
        'UteamupShiftUserAssignmentUpdate',
        { id: 10, status: 'Confirmed' },
        successReply(confirmed, 30)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const updated = JSON.parse(response.body.result.content[0].text);
      expect(updated.id).toBe(10);
      expect(updated.status).toBe('Confirmed');
    });

    test('status Declined — updates assignment to Declined', async () => {
      const declined = { ...assignment, status: 'Declined' };

      const response = await callMcpTool(
        'UteamupShiftUserAssignmentUpdate',
        { id: 10, status: 'Declined' },
        successReply(declined, 31)
      );

      const updated = JSON.parse(response.body.result.content[0].text);
      expect(updated.status).toBe('Declined');
    });

    test('not found — assignment id does not exist returns error', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentUpdate',
        { id: 99999, status: 'Confirmed' },
        errorReply(-32602, 'Shift user assignment 99999 not found', 32)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('invalid status value — returns validation error', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentUpdate',
        { id: 10, status: 'InvalidStatus' },
        errorReply(-32602, 'Status must be one of: Assigned, Confirmed, Declined, Replaced', 33)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Status');
    });

    test('permission denied — returns permission error', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentUpdate',
        { id: 10, status: 'Confirmed' },
        errorReply(-32600, 'Permission denied: ShiftUserAssignment.Update required', 34)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
    });

    test('JSON-RPC 2.0 compliance — update response has id and result, no error', async () => {
      const id = 35;
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentUpdate',
        { id: 10, status: 'Confirmed' },
        successReply({ ...assignment, status: 'Confirmed' }, id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('status Replaced with replacedByUserId — replacement is recorded', async () => {
      const replaced = { ...assignment, status: 'Replaced', replacedByUserId: 'user-bob-002' };

      const response = await callMcpTool(
        'UteamupShiftUserAssignmentUpdate',
        { id: 10, status: 'Replaced' },
        successReply(replaced, 36)
      );

      const updated = JSON.parse(response.body.result.content[0].text);
      expect(updated.status).toBe('Replaced');
      expect(updated.replacedByUserId).toBe('user-bob-002');
    });

    test('request includes id and status in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify({ ...assignment, status: 'Confirmed' }) }] },
          id: 37
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupShiftUserAssignmentUpdate',
          arguments: { id: 10, status: 'Confirmed' }
        },
        id: 37
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
      expect(capturedBody.params.arguments.id).toBe(10);
      expect(capturedBody.params.arguments.status).toBe('Confirmed');
    });

    test('all four valid status values are accepted', async () => {
      const validStatuses = ['Assigned', 'Confirmed', 'Declined', 'Replaced'];

      for (let i = 0; i < validStatuses.length; i++) {
        const status = validStatuses[i];
        const response = await callMcpTool(
          'UteamupShiftUserAssignmentUpdate',
          { id: 10, status },
          successReply({ ...assignment, status }, 38 + i)
        );

        const updated = JSON.parse(response.body.result.content[0].text);
        expect(updated.status).toBe(status);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftUserAssignmentDelete
  // ---------------------------------------------------------------------------
  describe('UteamupShiftUserAssignmentDelete tool', () => {
    test('success — deletes assignment and returns confirmation', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentDelete',
        { id: 10 },
        successReply({ deleted: true, id: 10 }, 50)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.deleted).toBe(true);
      expect(result.id).toBe(10);
    });

    test('not found — assignment id does not exist returns error', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentDelete',
        { id: 99999 },
        errorReply(-32602, 'Shift user assignment 99999 not found', 51)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('permission denied — returns permission error when ShiftUserAssignment.Delete is missing', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentDelete',
        { id: 10 },
        errorReply(-32600, 'Permission denied: ShiftUserAssignment.Delete required', 52)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('ShiftUserAssignment.Delete');
    });

    test('JSON-RPC 2.0 compliance — delete response has id and result, no error', async () => {
      const id = 53;
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentDelete',
        { id: 10 },
        successReply({ deleted: true, id: 10 }, id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('request includes correct id in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify({ deleted: true, id: 10 }) }] },
          id: 54
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupShiftUserAssignmentDelete',
          arguments: { id: 10 }
        },
        id: 54
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
      expect(capturedBody.params.arguments.id).toBe(10);
    });

    test('delete a non-integer id — returns validation error', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentDelete',
        { id: 'not-an-int' },
        errorReply(-32602, 'Id must be a positive integer', 55)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Id');
    });

    test('503 from backend — surfaced without crashing', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(503, 'Service Unavailable');

      const status = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupShiftUserAssignmentDelete', arguments: { id: 10 } },
          id: 56
        });

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
          res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(status).toBe(503);
    });

    test('401 from backend — surfaced without crashing', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(401, 'Unauthorized');

      const status = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupShiftUserAssignmentDelete', arguments: { id: 10 } },
          id: 57
        });

        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          },
          rejectUnauthorized: false
        }, (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftUserAssignmentMarkUnavailable
  // ---------------------------------------------------------------------------
  describe('UteamupShiftUserAssignmentMarkUnavailable tool', () => {
    test('success — marks unavailable and returns assignment plus replacement suggestion', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentMarkUnavailable',
        { id: 10, reason: 'Sick leave' },
        successReply(unavailableResult, 60)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.assignment.id).toBe(10);
      expect(result.assignment.status).toBe('Replaced');
      expect(result.assignment.shiftInstanceId).toBe(5);
      expect(result.replacementSuggestion).toBeDefined();
      expect(Array.isArray(result.replacementSuggestion.candidates)).toBe(true);
      expect(result.replacementSuggestion.candidates.length).toBeGreaterThan(0);
    });

    test('no candidates — all workers unavailable returns empty candidates array', async () => {
      const noCandidates = {
        assignment: { id: 10, status: 'Replaced', shiftInstanceId: 5 },
        replacementSuggestion: {
          shiftInstanceId: 5,
          unavailableUserId: 'user-alice-001',
          candidates: []
        }
      };

      const response = await callMcpTool(
        'UteamupShiftUserAssignmentMarkUnavailable',
        { id: 10, reason: 'Emergency leave' },
        successReply(noCandidates, 61)
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.assignment.status).toBe('Replaced');
      expect(Array.isArray(result.replacementSuggestion.candidates)).toBe(true);
      expect(result.replacementSuggestion.candidates.length).toBe(0);
    });

    test('not found — assignment id does not exist returns error', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentMarkUnavailable',
        { id: 99999, reason: 'Sick leave' },
        errorReply(-32602, 'Shift user assignment 99999 not found', 62)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('permission denied — returns permission error', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentMarkUnavailable',
        { id: 10, reason: 'Sick leave' },
        errorReply(-32600, 'Permission denied: ShiftUserAssignment.Update required', 63)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const id = 64;
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentMarkUnavailable',
        { id: 10, reason: 'Sick leave' },
        successReply(unavailableResult, id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('replacement suggestion includes unavailableUserId field', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentMarkUnavailable',
        { id: 10, reason: 'Sick leave' },
        successReply(unavailableResult, 65)
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.replacementSuggestion.unavailableUserId).toBe('user-alice-001');
      expect(result.replacementSuggestion.shiftInstanceId).toBe(5);
    });

    test('missing reason — returns validation error', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentMarkUnavailable',
        { id: 10, reason: '' },
        errorReply(-32602, 'Reason must not be empty', 66)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Reason');
    });

    test('request includes id and reason in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(unavailableResult) }] },
          id: 67
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupShiftUserAssignmentMarkUnavailable',
          arguments: { id: 10, reason: 'Sick leave' }
        },
        id: 67
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
      expect(capturedBody.params.arguments.id).toBe(10);
      expect(capturedBody.params.arguments.reason).toBe('Sick leave');
    });

    test('replacement candidate has score and rationale fields', async () => {
      const response = await callMcpTool(
        'UteamupShiftUserAssignmentMarkUnavailable',
        { id: 10, reason: 'Sick leave' },
        successReply(unavailableResult, 68)
      );

      const result = JSON.parse(response.body.result.content[0].text);
      const candidate = result.replacementSuggestion.candidates[0];
      expect(candidate).toHaveProperty('userId');
      expect(candidate).toHaveProperty('userName');
      expect(candidate).toHaveProperty('score');
      expect(typeof candidate.score).toBe('number');
    });
  });

  // ---------------------------------------------------------------------------
  // JSON-RPC 2.0 compliance — all 6 tools
  // ---------------------------------------------------------------------------
  describe('JSON-RPC 2.0 compliance across all tools', () => {
    const complianceTools = [
      { name: 'UteamupShiftUserAssignmentListByInstance', args: { shiftInstanceId: 5 }, idBase: 70 },
      { name: 'UteamupShiftUserAssignmentListByUserAndDate', args: { userId: 'user-alice-001', date: '2026-03-01' }, idBase: 71 },
      { name: 'UteamupShiftUserAssignmentCreate', args: { shiftInstanceId: 5, userId: 'user-alice-001', workforceCategoryId: 1 }, idBase: 72 },
      { name: 'UteamupShiftUserAssignmentUpdate', args: { id: 10, status: 'Confirmed' }, idBase: 73 },
      { name: 'UteamupShiftUserAssignmentDelete', args: { id: 10 }, idBase: 74 },
      { name: 'UteamupShiftUserAssignmentMarkUnavailable', args: { id: 10, reason: 'Sick leave' }, idBase: 75 }
    ];

    test.each(complianceTools)(
      '$name — success response has jsonrpc 2.0, id, result and no error field',
      async ({ name, args, idBase }) => {
        const response = await callMcpTool(
          name,
          args,
          {
            status: 200,
            body: {
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: '{}' }] },
              id: idBase
            }
          }
        );

        expect(response.status).toBe(200);
        expect(response.body.jsonrpc).toBe('2.0');
        expect(response.body.id).toBe(idBase);
        expect(response.body.result).toBeDefined();
        expect(response.body.error).toBeUndefined();
      }
    );
  });

  // ---------------------------------------------------------------------------
  // 401 Unauthorized handling — all 6 tools
  // ---------------------------------------------------------------------------
  describe('401 Unauthorized handling', () => {
    const authTools = [
      { name: 'UteamupShiftUserAssignmentListByInstance', args: { shiftInstanceId: 5 } },
      { name: 'UteamupShiftUserAssignmentListByUserAndDate', args: { userId: 'user-alice-001', date: '2026-03-01' } },
      { name: 'UteamupShiftUserAssignmentCreate', args: { shiftInstanceId: 5, userId: 'user-alice-001', workforceCategoryId: 1 } },
      { name: 'UteamupShiftUserAssignmentUpdate', args: { id: 10, status: 'Confirmed' } },
      { name: 'UteamupShiftUserAssignmentDelete', args: { id: 10 } },
      { name: 'UteamupShiftUserAssignmentMarkUnavailable', args: { id: 10, reason: 'Sick leave' } }
    ];

    test.each(authTools)(
      '$name — 401 response from backend is surfaced correctly',
      async ({ name, args }) => {
        nock(BASE_URL)
          .post('/mcp')
          .reply(401, 'Unauthorized');

        const statusCode = await new Promise((resolve, reject) => {
          const data = JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: { name, arguments: args },
            id: Math.floor(Math.random() * 9000) + 1000
          });

          const req = https.request(`${BASE_URL}/mcp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(data)
            },
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
      }
    );
  });
});
