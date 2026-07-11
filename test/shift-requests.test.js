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
 *   UteamupShiftRequestCreate(requestType, requestedDate, shiftGuid, reason)
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
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Shift Request MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_shift_requests';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Mock data
  // ---------------------------------------------------------------------------
  const shiftRequest = {
    externalGuid: '11111111-1111-4111-8111-111111111111',
    userGuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    userName: 'Alice Smith',
    shiftGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    shiftName: 'Morning Shift',
    workforceGroupGuid: null,
    requestType: 'DateRequest',
    requestedDate: '2026-03-01T00:00:00Z',
    reason: 'Need to work this day',
    status: 'Pending',
    reviewedByUserGuid: null,
    reviewedAt: null,
    reviewNotes: null
  };

  const approvedRequest = {
    ...shiftRequest,
    status: 'Approved',
    reviewedByUserGuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    reviewedAt: '2026-02-25T10:00:00Z',
    reviewNotes: 'Approved as requested'
  };

  const deniedRequest = {
    ...shiftRequest,
    status: 'Denied',
    reviewedByUserGuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    reviewedAt: '2026-02-25T10:05:00Z',
    reviewNotes: 'Not enough staff available'
  };

  // ---------------------------------------------------------------------------
  // UteamupShiftRequestList
  // ---------------------------------------------------------------------------
  describe('UteamupShiftRequestList tool', () => {
    test('list all pending requests — returns requests with Pending status', async () => {
      const pendingRequests = [
        { ...shiftRequest },
        { ...shiftRequest, externalGuid: '22222222-2222-4222-8222-222222222222', userGuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', userName: 'Bob Jones', requestedDate: '2026-03-02T00:00:00Z' }
      ];

      const response = await call(
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
      const response = await call(
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
      const response = await call(
        'UteamupShiftRequestList',
        { userId: 'user-alice-001' },
        successReply([shiftRequest], 3)
      );

      const requests = JSON.parse(response.body.result.content[0].text);
      expect(requests.length).toBe(1);
      expect(requests[0].userGuid).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    });

    test('empty list — no requests matching filters returns empty array', async () => {
      const response = await call(
        'UteamupShiftRequestList',
        { status: 'Denied' },
        successReply([], 4)
      );

      const requests = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(requests)).toBe(true);
      expect(requests.length).toBe(0);
    });

    test('permission denied — returns permission error', async () => {
      const response = await call(
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
        { ...shiftRequest, status: 'Pending' },
        { ...approvedRequest, externalGuid: '22222222-2222-4222-8222-222222222222' },
        { ...deniedRequest, externalGuid: '33333333-3333-4333-8333-333333333333' }
      ];

      const response = await call(
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
      const response = await call(
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
      const response = await call(
        'UteamupShiftRequestList',
        { status: 'Pending', userId: 'user-alice-001' },
        successReply([shiftRequest], 9)
      );

      const requests = JSON.parse(response.body.result.content[0].text);
      expect(requests.length).toBe(1);
      expect(requests[0].userGuid).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
      expect(requests[0].status).toBe('Pending');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftRequestGet
  // ---------------------------------------------------------------------------
  describe('UteamupShiftRequestGet tool', () => {
    test('found — returns shift request with full shape', async () => {
      const response = await call(
        'UteamupShiftRequestGet',
        { id: 1 },
        successReply(shiftRequest, 10)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const request = JSON.parse(response.body.result.content[0].text);
      expect(request.externalGuid).toBe('11111111-1111-4111-8111-111111111111');
      expect(request.userGuid).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
      expect(request.shiftName).toBe('Morning Shift');
      expect(request.requestType).toBe('DateRequest');
      expect(request.status).toBe('Pending');
    });

    test('not found — id does not exist returns error', async () => {
      const response = await call(
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
      const response = await call(
        'UteamupShiftRequestGet',
        { id: 1 },
        successReply(shiftRequest, id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('approved request — includes reviewedByUserGuid, reviewedAt, and reviewNotes', async () => {
      const response = await call(
        'UteamupShiftRequestGet',
        { id: 2 },
        successReply(approvedRequest, 13)
      );

      const request = JSON.parse(response.body.result.content[0].text);
      expect(request.status).toBe('Approved');
      expect(request.reviewedByUserGuid).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
      expect(request.reviewedAt).toBeDefined();
      expect(request.reviewNotes).toBe('Approved as requested');
    });

    test('pending request — reviewedByUserGuid, reviewedAt and reviewNotes are null', async () => {
      const response = await call(
        'UteamupShiftRequestGet',
        { id: 1 },
        successReply(shiftRequest, 14)
      );

      const request = JSON.parse(response.body.result.content[0].text);
      expect(request.reviewedByUserGuid).toBeNull();
      expect(request.reviewedAt).toBeNull();
      expect(request.reviewNotes).toBeNull();
    });

    test('permission denied — returns permission error', async () => {
      const response = await call(
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
      const response = await call(
        'UteamupShiftRequestCreate',
        { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', reason: 'Need to work this day' },
        successReply(shiftRequest, 20)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const created = JSON.parse(response.body.result.content[0].text);
      expect(created.externalGuid).toBe('11111111-1111-4111-8111-111111111111');
      expect(created.requestType).toBe('DateRequest');
      expect(created.status).toBe('Pending');
      expect(created.shiftGuid).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
      expect(created.reason).toBe('Need to work this day');
    });

    test('invalid date — requestedDate is not a valid date returns error', async () => {
      const response = await call(
        'UteamupShiftRequestCreate',
        { requestType: 'DateRequest', requestedDate: 'not-a-date', shiftGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', reason: 'test' },
        errorReply(-32602, 'RequestedDate must be a valid date string in YYYY-MM-DD format', 21)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('YYYY-MM-DD');
    });

    test('missing reason — empty reason returns validation error', async () => {
      const response = await call(
        'UteamupShiftRequestCreate',
        { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', reason: '' },
        errorReply(-32602, 'Reason must not be empty', 22)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Reason');
    });

    test('shift not found — shiftGuid does not exist returns error', async () => {
      const response = await call(
        'UteamupShiftRequestCreate',
        { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftGuid: '99999999-9999-4999-8999-999999999999', reason: 'test' },
        errorReply(-32602, 'Selected shift not found', 23)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('JSON-RPC 2.0 compliance — create response has id and result, no error', async () => {
      const id = 24;
      const response = await call(
        'UteamupShiftRequestCreate',
        { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', reason: 'test' },
        successReply(shiftRequest, id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('permission denied — returns permission error', async () => {
      const response = await call(
        'UteamupShiftRequestCreate',
        { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', reason: 'test' },
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
          arguments: { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', reason: 'Need to work this day' }
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
      expect(capturedBody.params.arguments.shiftGuid).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
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
            arguments: { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', reason: 'test' }
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
      const response = await call(
        'UteamupShiftRequestCreate',
        { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', reason: 'test' },
        successReply(shiftRequest, 28)
      );

      const created = JSON.parse(response.body.result.content[0].text);
      expect(created.status).toBe('Pending');
      expect(created.reviewedByUserGuid).toBeNull();
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
        externalGuid: '55555555-5555-4555-8555-555555555555',
        requestType: 'AvailabilityDeclaration',
        requestedDate: null,
        availableDaysMask: 31, // Monday–Friday bitmask
        availableFrom: '08:00',
        availableTo: '16:00',
        reason: 'Available for morning shifts next month'
      };

      const response = await call(
        'UteamupShiftRequestCreate',
        {
          requestType: 'AvailabilityDeclaration',
          availableDaysMask: 31,
          availableFrom: '08:00',
          availableTo: '16:00',
          shiftGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
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
      const response = await call(
        'UteamupShiftRequestCreate',
        { requestType: 'AvailabilityDeclaration', availableDaysMask: 0, shiftGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', reason: 'test' },
        errorReply(-32602, 'AvailableDaysMask must be between 1 and 127', 31)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('AvailableDaysMask');
    });

    test('availableFrom after availableTo — returns validation error', async () => {
      const response = await call(
        'UteamupShiftRequestCreate',
        {
          requestType: 'AvailabilityDeclaration',
          availableDaysMask: 31,
          availableFrom: '17:00',
          availableTo: '08:00',
          shiftGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          reason: 'test'
        },
        errorReply(-32602, 'AvailableFrom must be before AvailableTo', 32)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('AvailableFrom');
    });

    test('JSON-RPC 2.0 compliance — AvailabilityDeclaration response has id and result', async () => {
      const id = 33;
      const availabilityRequest = { ...shiftRequest, externalGuid: '55555555-5555-4555-8555-555555555555', requestType: 'AvailabilityDeclaration', availableDaysMask: 31 };

      const response = await call(
        'UteamupShiftRequestCreate',
        { requestType: 'AvailabilityDeclaration', availableDaysMask: 31, shiftGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', reason: 'test' },
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
            shiftGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
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

      const response = await call(
        'UteamupShiftRequestUpdate',
        { id: 1, reason: 'Updated reason' },
        successReply(updated, 40)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.externalGuid).toBe('11111111-1111-4111-8111-111111111111');
      expect(result.reason).toBe('Updated reason');
    });

    test('not found — id does not exist returns error', async () => {
      const response = await call(
        'UteamupShiftRequestUpdate',
        { id: 99999, reason: 'Updated' },
        errorReply(-32602, 'Shift request 99999 not found', 41)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('cannot update an already reviewed request — returns error', async () => {
      const response = await call(
        'UteamupShiftRequestUpdate',
        { id: 2, reason: 'Trying to update an approved request' },
        errorReply(-32602, 'Cannot update a shift request that has already been reviewed', 42)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('reviewed');
    });

    test('JSON-RPC 2.0 compliance — update response has id and result, no error', async () => {
      const id = 43;
      const response = await call(
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
      const response = await call(
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
      const response = await call(
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
      const response = await call(
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
      const response = await call(
        'UteamupShiftRequestDelete',
        { id: 99999 },
        errorReply(-32602, 'Shift request 99999 not found', 51)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('cannot delete a reviewed request — returns error', async () => {
      const response = await call(
        'UteamupShiftRequestDelete',
        { id: 2 },
        errorReply(-32602, 'Cannot delete a shift request that has already been reviewed', 52)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('reviewed');
    });

    test('JSON-RPC 2.0 compliance — delete response has id and result, no error', async () => {
      const id = 53;
      const response = await call(
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
      const response = await call(
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
      const response = await call(
        'UteamupShiftRequestApprove',
        { id: 1, notes: 'Approved as requested' },
        successReply(approvedRequest, 60)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.externalGuid).toBe('11111111-1111-4111-8111-111111111111');
      expect(result.status).toBe('Approved');
      expect(result.reviewNotes).toBe('Approved as requested');
      expect(result.reviewedByUserGuid).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
      expect(result.reviewedAt).toBeDefined();
    });

    test('already approved — returns error when request is already in Approved state', async () => {
      const response = await call(
        'UteamupShiftRequestApprove',
        { id: 1, notes: 'Approving again' },
        errorReply(-32602, 'Shift request 1 has already been reviewed', 61)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('already been reviewed');
    });

    test('not found — id does not exist returns error', async () => {
      const response = await call(
        'UteamupShiftRequestApprove',
        { id: 99999, notes: 'Approved' },
        errorReply(-32602, 'Shift request 99999 not found', 62)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('permission — ShiftRequest.Update required for approval', async () => {
      const response = await call(
        'UteamupShiftRequestApprove',
        { id: 1, notes: 'Approved' },
        errorReply(-32600, 'Permission denied: ShiftRequest.Update required', 63)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('ShiftRequest.Update');
    });

    test('JSON-RPC 2.0 compliance — approve response has id and result, no error', async () => {
      const id = 64;
      const response = await call(
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

      const response = await call(
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
      const response = await call(
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
      const response = await call(
        'UteamupShiftRequestDeny',
        { id: 1, notes: 'Not enough staff available' },
        successReply(deniedRequest, 70)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.externalGuid).toBe('11111111-1111-4111-8111-111111111111');
      expect(result.status).toBe('Denied');
      expect(result.reviewNotes).toBe('Not enough staff available');
      expect(result.reviewedByUserGuid).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
      expect(result.reviewedAt).toBeDefined();
    });

    test('deny with notes — reviewNotes field is populated from notes arg', async () => {
      const customDenied = { ...deniedRequest, reviewNotes: 'Shift already fully staffed for that day' };

      const response = await call(
        'UteamupShiftRequestDeny',
        { id: 1, notes: 'Shift already fully staffed for that day' },
        successReply(customDenied, 71)
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.reviewNotes).toBe('Shift already fully staffed for that day');
    });

    test('already reviewed — returns error when request is already Denied', async () => {
      const response = await call(
        'UteamupShiftRequestDeny',
        { id: 1, notes: 'Denying again' },
        errorReply(-32602, 'Shift request 1 has already been reviewed', 72)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('already been reviewed');
    });

    test('not found — id does not exist returns error', async () => {
      const response = await call(
        'UteamupShiftRequestDeny',
        { id: 99999, notes: 'Denied' },
        errorReply(-32602, 'Shift request 99999 not found', 73)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('permission — ShiftRequest.Update required for denial', async () => {
      const response = await call(
        'UteamupShiftRequestDeny',
        { id: 1, notes: 'Denied' },
        errorReply(-32600, 'Permission denied: ShiftRequest.Update required', 74)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('ShiftRequest.Update');
    });

    test('JSON-RPC 2.0 compliance — deny response has id and result, no error', async () => {
      const id = 75;
      const response = await call(
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

      const response = await call(
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
      const response = await call(
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
  // Shared tool definitions for error-handling factories
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupShiftRequestList', args: {} },
    { name: 'UteamupShiftRequestGet', args: { id: 1 } },
    { name: 'UteamupShiftRequestCreate', args: { requestType: 'DateRequest', requestedDate: '2026-03-01', shiftGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', reason: 'test' } },
    { name: 'UteamupShiftRequestUpdate', args: { id: 1, reason: 'Updated' } },
    { name: 'UteamupShiftRequestDelete', args: { id: 1 } },
    { name: 'UteamupShiftRequestApprove', args: { id: 1, notes: 'Approved' } },
    { name: 'UteamupShiftRequestDeny', args: { id: 1, notes: 'Denied' } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
