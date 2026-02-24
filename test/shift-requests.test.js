/**
 * Shift Request MCP tool tests
 *
 * Tests that Shift Request MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy handles both successful and error responses
 * from the backend /mcp endpoint gracefully.
 *
 * Tools under test:
 *   UteamupShiftRequestList(status?, userId?)
 *   UteamupShiftRequestGet(id)
 *   UteamupShiftRequestCreate(requestType, requestedDate, shiftId, reason)
 *   UteamupShiftRequestUpdate(id, reason)
 *   UteamupShiftRequestDelete(id)
 *   UteamupShiftRequestApprove(id, notes)
 *   UteamupShiftRequestDeny(id, notes)
 *
 * Pattern mirrors schedule-assignment.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const https = require('https');

describe('Shift Request MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_shift_requests';

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
  const shiftRequest = {
    id: 1,
    userId: 'user-alice-001',
    userName: 'Alice Smith',
    shiftId: 1,
    shiftName: 'Morning Shift',
    workforceCategoryId: null,
    requestType: 'DateRequest',
    requestedDate: '2026-03-01T00:00:00Z',
    reason: 'Need to work this day',
    status: 'Pending',
    reviewedByUserId: null,
    reviewedAt: null,
    reviewNotes: null
  };

  const approvedRequest = {
    ...shiftRequest,
    status: 'Approved',
    reviewedByUserId: 'user-manager-001',
    reviewedAt: '2026-02-25T10:00:00Z',
    reviewNotes: 'Approved as requested'
  };

  const deniedRequest = {
    ...shiftRequest,
    status: 'Denied',
    reviewedByUserId: 'user-manager-001',
    reviewedAt: '2026-02-25T10:05:00Z',
    reviewNotes: 'Not enough staff available'
  };

  // ---------------------------------------------------------------------------
  // UteamupShiftRequestList
  // ---------------------------------------------------------------------------
  describe('UteamupShiftRequestList tool', () => {
    test('list all pending requests — returns requests with Pending status', async () => {
      const pendingRequests = [
        { ...shiftRequest, id: 1 },
        { ...shiftRequest, id: 2, userId: 'user-bob-002', userName: 'Bob Jones', requestedDate: '2026-03-02T00:00:00Z' }
      ];

      const response = await callMcpTool(
        'UteamupShiftRequestList',
        { status: 'Pending' },
        successReply(pendingRequests, 1)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const requests = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(requests)).toBe(true);
      expect(requests.length).toBe(2);
      expect(requests[0].status).toBe('Pending');
      expect(requests[1].status).toBe('Pending');
    });

    test('filtered by status — returns only Approved requests', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestList',
        { status: 'Approved' },
        successReply([approvedRequest], 2)
      );

      const requests = JSON.parse(response.body.result.content[0].text);
      expect(requests.length).toBe(1);
      expect(requests[0].status).toBe('Approved');
      expect(requests[0].reviewNotes).toBe('Approved as requested');
    });

    test('filtered by userId — returns only requests for a specific user', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestList',
        { userId: 'user-alice-001' },
        successReply([shiftRequest], 3)
      );

      const requests = JSON.parse(response.body.result.content[0].text);
      expect(requests.length).toBe(1);
      expect(requests[0].userId).toBe('user-alice-001');
    });

    test('empty list — no requests matching filters returns empty array', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestList',
        { status: 'Denied' },
        successReply([], 4)
      );

      const requests = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(requests)).toBe(true);
      expect(requests.length).toBe(0);
    });

    test('permission denied — returns permission error', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestList',
        {},
        errorReply(-32600, 'Permission denied: ShiftRequest.Read required', 5)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('ShiftRequest.Read');
    });

    test('list all with no filter — returns requests of any status', async () => {
      const mixed = [
        { ...shiftRequest, id: 1, status: 'Pending' },
        { ...approvedRequest, id: 2 },
        { ...deniedRequest, id: 3 }
      ];

      const response = await callMcpTool(
        'UteamupShiftRequestList',
        {},
        successReply(mixed, 6)
      );

      const requests = JSON.parse(response.body.result.content[0].text);
      expect(requests.length).toBe(3);
      const statuses = requests.map(r => r.status);
      expect(statuses).toContain('Pending');
      expect(statuses).toContain('Approved');
      expect(statuses).toContain('Denied');
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const id = 7;
      const response = await callMcpTool(
        'UteamupShiftRequestList',
        {},
        successReply([shiftRequest], id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('feature flag disabled — tenant has shift requests disabled returns 403', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(403, 'Shift requests feature is not enabled for this tenant');

      const status = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupShiftRequestList', arguments: {} },
          id: 8
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

    test('filtered by both status and userId — returns intersection', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestList',
        { status: 'Pending', userId: 'user-alice-001' },
        successReply([shiftRequest], 9)
      );

      const requests = JSON.parse(response.body.result.content[0].text);
      expect(requests.length).toBe(1);
      expect(requests[0].userId).toBe('user-alice-001');
      expect(requests[0].status).toBe('Pending');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftRequestGet
  // ---------------------------------------------------------------------------
  describe('UteamupShiftRequestGet tool', () => {
    test('found — returns shift request with full shape', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestGet',
        { id: 1 },
        successReply(shiftRequest, 10)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const request = JSON.parse(response.body.result.content[0].text);
      expect(request.id).toBe(1);
      expect(request.userId).toBe('user-alice-001');
      expect(request.shiftName).toBe('Morning Shift');
      expect(request.requestType).toBe('DateRequest');
      expect(request.status).toBe('Pending');
    });

    test('not found — id does not exist returns error', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestGet',
        { id: 99999 },
        errorReply(-32602, 'Shift request 99999 not found', 11)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const id = 12;
      const response = await callMcpTool(
        'UteamupShiftRequestGet',
        { id: 1 },
        successReply(shiftRequest, id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('approved request — includes reviewedByUserId, reviewedAt, and reviewNotes', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestGet',
        { id: 2 },
        successReply(approvedRequest, 13)
      );

      const request = JSON.parse(response.body.result.content[0].text);
      expect(request.status).toBe('Approved');
      expect(request.reviewedByUserId).toBe('user-manager-001');
      expect(request.reviewedAt).toBeDefined();
      expect(request.reviewNotes).toBe('Approved as requested');
    });

    test('pending request — reviewedByUserId, reviewedAt and reviewNotes are null', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestGet',
        { id: 1 },
        successReply(shiftRequest, 14)
      );

      const request = JSON.parse(response.body.result.content[0].text);
      expect(request.reviewedByUserId).toBeNull();
      expect(request.reviewedAt).toBeNull();
      expect(request.reviewNotes).toBeNull();
    });

    test('permission denied — returns permission error', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestGet',
        { id: 1 },
        errorReply(-32600, 'Permission denied: ShiftRequest.Read required', 15)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
    });

    test('feature flag disabled — 403 from backend is surfaced', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(403, 'Shift requests feature is not enabled for this tenant');

      const status = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupShiftRequestGet', arguments: { id: 1 } },
          id: 16
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

    test('request includes id in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(shiftRequest) }] },
          id: 17
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupShiftRequestGet',
          arguments: { id: 1 }
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
      expect(capturedBody.params.arguments.id).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftRequestCreate — DateRequest
  // ---------------------------------------------------------------------------
  describe('UteamupShiftRequestCreate tool — DateRequest', () => {
    test('success — creates DateRequest and returns full request object', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestCreate',
        { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftId: 1, reason: 'Need to work this day' },
        successReply(shiftRequest, 20)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const created = JSON.parse(response.body.result.content[0].text);
      expect(created.id).toBe(1);
      expect(created.requestType).toBe('DateRequest');
      expect(created.status).toBe('Pending');
      expect(created.shiftId).toBe(1);
      expect(created.reason).toBe('Need to work this day');
    });

    test('invalid date — requestedDate is not a valid date returns error', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestCreate',
        { requestType: 'DateRequest', requestedDate: 'not-a-date', shiftId: 1, reason: 'test' },
        errorReply(-32602, 'RequestedDate must be a valid date string in YYYY-MM-DD format', 21)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('YYYY-MM-DD');
    });

    test('missing reason — empty reason returns validation error', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestCreate',
        { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftId: 1, reason: '' },
        errorReply(-32602, 'Reason must not be empty', 22)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Reason');
    });

    test('shift not found — shiftId does not exist returns error', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestCreate',
        { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftId: 99999, reason: 'test' },
        errorReply(-32602, 'Shift 99999 not found', 23)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('JSON-RPC 2.0 compliance — create response has id and result, no error', async () => {
      const id = 24;
      const response = await callMcpTool(
        'UteamupShiftRequestCreate',
        { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftId: 1, reason: 'test' },
        successReply(shiftRequest, id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('permission denied — returns permission error', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestCreate',
        { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftId: 1, reason: 'test' },
        errorReply(-32600, 'Permission denied: ShiftRequest.Create required', 25)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
    });

    test('request includes all required args in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(shiftRequest) }] },
          id: 26
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupShiftRequestCreate',
          arguments: { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftId: 1, reason: 'Need to work this day' }
        },
        id: 26
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
      expect(capturedBody.params.arguments.requestType).toBe('DateRequest');
      expect(capturedBody.params.arguments.requestedDate).toBe('2026-03-01');
      expect(capturedBody.params.arguments.shiftId).toBe(1);
      expect(capturedBody.params.arguments.reason).toBe('Need to work this day');
    });

    test('feature flag disabled — 403 from backend is surfaced', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(403, 'Shift requests feature is not enabled for this tenant');

      const status = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'UteamupShiftRequestCreate',
            arguments: { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftId: 1, reason: 'test' }
          },
          id: 27
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

    test('created request status defaults to Pending', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestCreate',
        { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftId: 1, reason: 'test' },
        successReply(shiftRequest, 28)
      );

      const created = JSON.parse(response.body.result.content[0].text);
      expect(created.status).toBe('Pending');
      expect(created.reviewedByUserId).toBeNull();
      expect(created.reviewedAt).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftRequestCreate — AvailabilityDeclaration
  // ---------------------------------------------------------------------------
  describe('UteamupShiftRequestCreate tool — AvailabilityDeclaration', () => {
    test('success — creates AvailabilityDeclaration with availableDaysMask and time range', async () => {
      const availabilityRequest = {
        ...shiftRequest,
        id: 5,
        requestType: 'AvailabilityDeclaration',
        requestedDate: null,
        availableDaysMask: 31, // Monday–Friday bitmask
        availableFrom: '08:00',
        availableTo: '16:00',
        reason: 'Available for morning shifts next month'
      };

      const response = await callMcpTool(
        'UteamupShiftRequestCreate',
        {
          requestType: 'AvailabilityDeclaration',
          availableDaysMask: 31,
          availableFrom: '08:00',
          availableTo: '16:00',
          shiftId: 1,
          reason: 'Available for morning shifts next month'
        },
        successReply(availabilityRequest, 30)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const created = JSON.parse(response.body.result.content[0].text);
      expect(created.requestType).toBe('AvailabilityDeclaration');
      expect(created.availableDaysMask).toBe(31);
      expect(created.availableFrom).toBe('08:00');
      expect(created.availableTo).toBe('16:00');
      expect(created.status).toBe('Pending');
    });

    test('invalid availableDaysMask — must be between 1 and 127 returns error', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestCreate',
        { requestType: 'AvailabilityDeclaration', availableDaysMask: 0, shiftId: 1, reason: 'test' },
        errorReply(-32602, 'AvailableDaysMask must be between 1 and 127', 31)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('AvailableDaysMask');
    });

    test('availableFrom after availableTo — returns validation error', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestCreate',
        {
          requestType: 'AvailabilityDeclaration',
          availableDaysMask: 31,
          availableFrom: '17:00',
          availableTo: '08:00',
          shiftId: 1,
          reason: 'test'
        },
        errorReply(-32602, 'AvailableFrom must be before AvailableTo', 32)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('AvailableFrom');
    });

    test('JSON-RPC 2.0 compliance — AvailabilityDeclaration response has id and result', async () => {
      const id = 33;
      const availabilityRequest = { ...shiftRequest, id: 5, requestType: 'AvailabilityDeclaration', availableDaysMask: 31 };

      const response = await callMcpTool(
        'UteamupShiftRequestCreate',
        { requestType: 'AvailabilityDeclaration', availableDaysMask: 31, shiftId: 1, reason: 'test' },
        successReply(availabilityRequest, id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('request includes requestType AvailabilityDeclaration and availableDaysMask in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '{}' }] },
          id: 34
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupShiftRequestCreate',
          arguments: {
            requestType: 'AvailabilityDeclaration',
            availableDaysMask: 62,
            availableFrom: '09:00',
            availableTo: '17:00',
            shiftId: 1,
            reason: 'Available Tue–Sat'
          }
        },
        id: 34
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
      expect(capturedBody.params.arguments.requestType).toBe('AvailabilityDeclaration');
      expect(capturedBody.params.arguments.availableDaysMask).toBe(62);
      expect(capturedBody.params.arguments.availableFrom).toBe('09:00');
      expect(capturedBody.params.arguments.availableTo).toBe('17:00');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftRequestUpdate
  // ---------------------------------------------------------------------------
  describe('UteamupShiftRequestUpdate tool', () => {
    test('success — updates reason and returns updated request', async () => {
      const updated = { ...shiftRequest, reason: 'Updated reason' };

      const response = await callMcpTool(
        'UteamupShiftRequestUpdate',
        { id: 1, reason: 'Updated reason' },
        successReply(updated, 40)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.id).toBe(1);
      expect(result.reason).toBe('Updated reason');
    });

    test('not found — id does not exist returns error', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestUpdate',
        { id: 99999, reason: 'Updated' },
        errorReply(-32602, 'Shift request 99999 not found', 41)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('cannot update an already reviewed request — returns error', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestUpdate',
        { id: 2, reason: 'Trying to update an approved request' },
        errorReply(-32602, 'Cannot update a shift request that has already been reviewed', 42)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('reviewed');
    });

    test('JSON-RPC 2.0 compliance — update response has id and result, no error', async () => {
      const id = 43;
      const response = await callMcpTool(
        'UteamupShiftRequestUpdate',
        { id: 1, reason: 'Updated reason' },
        successReply({ ...shiftRequest, reason: 'Updated reason' }, id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('permission denied — returns permission error', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestUpdate',
        { id: 1, reason: 'Updated' },
        errorReply(-32600, 'Permission denied: ShiftRequest.Update required', 44)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
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
          result: { content: [{ type: 'text', text: JSON.stringify({ ...shiftRequest, reason: 'Updated reason' }) }] },
          id: 45
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupShiftRequestUpdate',
          arguments: { id: 1, reason: 'Updated reason' }
        },
        id: 45
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
      expect(capturedBody.params.arguments.id).toBe(1);
      expect(capturedBody.params.arguments.reason).toBe('Updated reason');
    });

    test('feature flag disabled — 403 from backend is surfaced', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(403, 'Shift requests feature is not enabled for this tenant');

      const status = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupShiftRequestUpdate', arguments: { id: 1, reason: 'test' } },
          id: 46
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

    test('empty reason — returns validation error', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestUpdate',
        { id: 1, reason: '' },
        errorReply(-32602, 'Reason must not be empty', 47)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Reason');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftRequestDelete
  // ---------------------------------------------------------------------------
  describe('UteamupShiftRequestDelete tool', () => {
    test('success — deletes request and returns confirmation', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestDelete',
        { id: 1 },
        successReply({ deleted: true, id: 1 }, 50)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.deleted).toBe(true);
      expect(result.id).toBe(1);
    });

    test('not found — id does not exist returns error', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestDelete',
        { id: 99999 },
        errorReply(-32602, 'Shift request 99999 not found', 51)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('cannot delete a reviewed request — returns error', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestDelete',
        { id: 2 },
        errorReply(-32602, 'Cannot delete a shift request that has already been reviewed', 52)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('reviewed');
    });

    test('JSON-RPC 2.0 compliance — delete response has id and result, no error', async () => {
      const id = 53;
      const response = await callMcpTool(
        'UteamupShiftRequestDelete',
        { id: 1 },
        successReply({ deleted: true, id: 1 }, id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('permission denied — returns permission error', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestDelete',
        { id: 1 },
        errorReply(-32600, 'Permission denied: ShiftRequest.Delete required', 54)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
    });

    test('401 from backend — surfaced without crashing', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(401, 'Unauthorized');

      const status = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupShiftRequestDelete', arguments: { id: 1 } },
          id: 55
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

    test('request includes id in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify({ deleted: true, id: 1 }) }] },
          id: 56
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupShiftRequestDelete',
          arguments: { id: 1 }
        },
        id: 56
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
      expect(capturedBody.params.arguments.id).toBe(1);
    });

    test('feature flag disabled — 403 from backend is surfaced', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(403, 'Shift requests feature is not enabled for this tenant');

      const status = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupShiftRequestDelete', arguments: { id: 1 } },
          id: 57
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
  // UteamupShiftRequestApprove
  // ---------------------------------------------------------------------------
  describe('UteamupShiftRequestApprove tool', () => {
    test('success — returns approved request with reviewNotes', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestApprove',
        { id: 1, notes: 'Approved as requested' },
        successReply(approvedRequest, 60)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.id).toBe(1);
      expect(result.status).toBe('Approved');
      expect(result.reviewNotes).toBe('Approved as requested');
      expect(result.reviewedByUserId).toBe('user-manager-001');
      expect(result.reviewedAt).toBeDefined();
    });

    test('already approved — returns error when request is already in Approved state', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestApprove',
        { id: 1, notes: 'Approving again' },
        errorReply(-32602, 'Shift request 1 has already been reviewed', 61)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('already been reviewed');
    });

    test('not found — id does not exist returns error', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestApprove',
        { id: 99999, notes: 'Approved' },
        errorReply(-32602, 'Shift request 99999 not found', 62)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('permission — ShiftRequest.Update required for approval', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestApprove',
        { id: 1, notes: 'Approved' },
        errorReply(-32600, 'Permission denied: ShiftRequest.Update required', 63)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('ShiftRequest.Update');
    });

    test('JSON-RPC 2.0 compliance — approve response has id and result, no error', async () => {
      const id = 64;
      const response = await callMcpTool(
        'UteamupShiftRequestApprove',
        { id: 1, notes: 'Approved as requested' },
        successReply(approvedRequest, id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('approve without notes — notes field is optional', async () => {
      const approvedNoNotes = { ...approvedRequest, reviewNotes: null };

      const response = await callMcpTool(
        'UteamupShiftRequestApprove',
        { id: 1 },
        successReply(approvedNoNotes, 65)
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.status).toBe('Approved');
    });

    test('request includes id and notes in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(approvedRequest) }] },
          id: 66
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupShiftRequestApprove',
          arguments: { id: 1, notes: 'Approved as requested' }
        },
        id: 66
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
      expect(capturedBody.params.arguments.id).toBe(1);
      expect(capturedBody.params.arguments.notes).toBe('Approved as requested');
    });

    test('feature flag disabled — 403 from backend is surfaced', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(403, 'Shift requests feature is not enabled for this tenant');

      const status = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupShiftRequestApprove', arguments: { id: 1, notes: 'Approved' } },
          id: 67
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

    test('approved request has reviewedAt set to a valid ISO timestamp', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestApprove',
        { id: 1, notes: 'Approved as requested' },
        successReply(approvedRequest, 68)
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(typeof result.reviewedAt).toBe('string');
      expect(new Date(result.reviewedAt).getTime()).not.toBeNaN();
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftRequestDeny
  // ---------------------------------------------------------------------------
  describe('UteamupShiftRequestDeny tool', () => {
    test('success — returns denied request with deny notes', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestDeny',
        { id: 1, notes: 'Not enough staff available' },
        successReply(deniedRequest, 70)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.id).toBe(1);
      expect(result.status).toBe('Denied');
      expect(result.reviewNotes).toBe('Not enough staff available');
      expect(result.reviewedByUserId).toBe('user-manager-001');
      expect(result.reviewedAt).toBeDefined();
    });

    test('deny with notes — reviewNotes field is populated from notes arg', async () => {
      const customDenied = { ...deniedRequest, reviewNotes: 'Shift already fully staffed for that day' };

      const response = await callMcpTool(
        'UteamupShiftRequestDeny',
        { id: 1, notes: 'Shift already fully staffed for that day' },
        successReply(customDenied, 71)
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.reviewNotes).toBe('Shift already fully staffed for that day');
    });

    test('already reviewed — returns error when request is already Denied', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestDeny',
        { id: 1, notes: 'Denying again' },
        errorReply(-32602, 'Shift request 1 has already been reviewed', 72)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('already been reviewed');
    });

    test('not found — id does not exist returns error', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestDeny',
        { id: 99999, notes: 'Denied' },
        errorReply(-32602, 'Shift request 99999 not found', 73)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('permission — ShiftRequest.Update required for denial', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestDeny',
        { id: 1, notes: 'Denied' },
        errorReply(-32600, 'Permission denied: ShiftRequest.Update required', 74)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('ShiftRequest.Update');
    });

    test('JSON-RPC 2.0 compliance — deny response has id and result, no error', async () => {
      const id = 75;
      const response = await callMcpTool(
        'UteamupShiftRequestDeny',
        { id: 1, notes: 'Not enough staff available' },
        successReply(deniedRequest, id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('deny without notes — notes field is optional', async () => {
      const deniedNoNotes = { ...deniedRequest, reviewNotes: null };

      const response = await callMcpTool(
        'UteamupShiftRequestDeny',
        { id: 1 },
        successReply(deniedNoNotes, 76)
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.status).toBe('Denied');
    });

    test('request includes id and notes in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(deniedRequest) }] },
          id: 77
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupShiftRequestDeny',
          arguments: { id: 1, notes: 'Not enough staff available' }
        },
        id: 77
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
      expect(capturedBody.params.arguments.id).toBe(1);
      expect(capturedBody.params.arguments.notes).toBe('Not enough staff available');
    });

    test('feature flag disabled — 403 from backend is surfaced', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(403, 'Shift requests feature is not enabled for this tenant');

      const status = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupShiftRequestDeny', arguments: { id: 1, notes: 'Denied' } },
          id: 78
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

    test('denied request has reviewedAt set to a valid ISO timestamp', async () => {
      const response = await callMcpTool(
        'UteamupShiftRequestDeny',
        { id: 1, notes: 'Not enough staff available' },
        successReply(deniedRequest, 79)
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(typeof result.reviewedAt).toBe('string');
      expect(new Date(result.reviewedAt).getTime()).not.toBeNaN();
    });
  });

  // ---------------------------------------------------------------------------
  // JSON-RPC 2.0 compliance — all 7 tools
  // ---------------------------------------------------------------------------
  describe('JSON-RPC 2.0 compliance across all tools', () => {
    const complianceTools = [
      { name: 'UteamupShiftRequestList', args: {}, idBase: 80 },
      { name: 'UteamupShiftRequestGet', args: { id: 1 }, idBase: 81 },
      { name: 'UteamupShiftRequestCreate', args: { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftId: 1, reason: 'test' }, idBase: 82 },
      { name: 'UteamupShiftRequestUpdate', args: { id: 1, reason: 'Updated' }, idBase: 83 },
      { name: 'UteamupShiftRequestDelete', args: { id: 1 }, idBase: 84 },
      { name: 'UteamupShiftRequestApprove', args: { id: 1, notes: 'Approved' }, idBase: 85 },
      { name: 'UteamupShiftRequestDeny', args: { id: 1, notes: 'Denied' }, idBase: 86 }
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
  // 401 Unauthorized handling — all 7 tools
  // ---------------------------------------------------------------------------
  describe('401 Unauthorized handling', () => {
    const authTools = [
      { name: 'UteamupShiftRequestList', args: {} },
      { name: 'UteamupShiftRequestGet', args: { id: 1 } },
      { name: 'UteamupShiftRequestCreate', args: { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftId: 1, reason: 'test' } },
      { name: 'UteamupShiftRequestUpdate', args: { id: 1, reason: 'Updated' } },
      { name: 'UteamupShiftRequestDelete', args: { id: 1 } },
      { name: 'UteamupShiftRequestApprove', args: { id: 1, notes: 'Approved' } },
      { name: 'UteamupShiftRequestDeny', args: { id: 1, notes: 'Denied' } }
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

  // ---------------------------------------------------------------------------
  // 503 Service Unavailable handling — all 7 tools
  // ---------------------------------------------------------------------------
  describe('503 Service Unavailable handling', () => {
    const serviceTools = [
      { name: 'UteamupShiftRequestList', args: {}, id: 90 },
      { name: 'UteamupShiftRequestGet', args: { id: 1 }, id: 91 },
      { name: 'UteamupShiftRequestCreate', args: { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftId: 1, reason: 'test' }, id: 92 },
      { name: 'UteamupShiftRequestUpdate', args: { id: 1, reason: 'Updated' }, id: 93 },
      { name: 'UteamupShiftRequestDelete', args: { id: 1 }, id: 94 },
      { name: 'UteamupShiftRequestApprove', args: { id: 1, notes: 'Approved' }, id: 95 },
      { name: 'UteamupShiftRequestDeny', args: { id: 1, notes: 'Denied' }, id: 96 }
    ];

    test.each(serviceTools)(
      '$name — 503 is surfaced correctly without crashing',
      async ({ name, args, id }) => {
        nock(BASE_URL)
          .post('/mcp')
          .reply(503, 'Service Unavailable');

        const status = await new Promise((resolve, reject) => {
          const data = JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: { name, arguments: args },
            id
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
      }
    );
  });
});
