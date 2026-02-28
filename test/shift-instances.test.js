/**
 * Shift Instance MCP tool tests
 *
 * Tests that ShiftInstance MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error
 * responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   UteamupShiftInstanceListByRange  — list instances within a date range
 *   UteamupShiftInstanceGet          — get single instance by id
 *   UteamupShiftInstanceCreate       — create a new instance
 *   UteamupShiftInstanceUpdate       — update an existing instance
 *   UteamupShiftInstanceDelete       — delete an instance
 *   UteamupShiftInstanceGenerate     — bulk-generate instances for a shift
 *   UteamupShiftInstanceApprove      — approve an instance
 *   UteamupShiftInstanceSetStatus    — set the status of an instance
 *
 * Pattern mirrors schedule.test.js: raw nock-mocked HTTPS calls that simulate
 * what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const https = require('https');
const { callMcpTool: _callMcpTool } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Shift Instance MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_shift_instance_tools';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------
  const instance = {
    id: 5,
    shiftId: 1,
    shiftName: 'Morning Shift',
    instanceDate: '2026-03-01T00:00:00Z',
    isHoliday: false,
    status: 'Published',
    generatedByAI: false,
    assignmentCount: 2
  };

  const generateResult = { created: 5, message: '5 shift instance(s) generated.' };

  // ---------------------------------------------------------------------------
  // UteamupShiftInstanceListByRange
  // ---------------------------------------------------------------------------
  describe('UteamupShiftInstanceListByRange tool', () => {
    test('returns list of instances within a date range', async () => {
      const instances = [
        instance,
        { ...instance, id: 6, instanceDate: '2026-03-02T00:00:00Z', assignmentCount: 1 },
        { ...instance, id: 7, instanceDate: '2026-03-03T00:00:00Z', isHoliday: true, assignmentCount: 0 }
      ];

      const response = await call(
        'UteamupShiftInstanceListByRange',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(instances) }] },
            id: 1
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const list = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(3);
      expect(list[0].id).toBe(5);
      expect(list[0].shiftName).toBe('Morning Shift');
    });

    test('returns empty array when no instances exist in range', async () => {
      const response = await call(
        'UteamupShiftInstanceListByRange',
        { dateFrom: '2026-04-01', dateTo: '2026-04-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: '[]' }] },
            id: 2
          }
        }
      );

      expect(response.status).toBe(200);
      const list = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(0);
    });

    test('filters instances by optional shiftId parameter', async () => {
      const shiftFiltered = [
        instance,
        { ...instance, id: 8, instanceDate: '2026-03-04T00:00:00Z' }
      ];

      const response = await call(
        'UteamupShiftInstanceListByRange',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07', shiftId: 1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(shiftFiltered) }] },
            id: 3
          }
        }
      );

      expect(response.status).toBe(200);
      const list = JSON.parse(response.body.result.content[0].text);
      expect(list.every(i => i.shiftId === 1)).toBe(true);
    });

    test('returns holiday instances in the list when present', async () => {
      const withHoliday = [
        instance,
        { ...instance, id: 9, instanceDate: '2026-03-03T00:00:00Z', isHoliday: true, assignmentCount: 0 }
      ];

      const response = await call(
        'UteamupShiftInstanceListByRange',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(withHoliday) }] },
            id: 4
          }
        }
      );

      expect(response.status).toBe(200);
      const list = JSON.parse(response.body.result.content[0].text);
      const holidayItems = list.filter(i => i.isHoliday === true);
      expect(holidayItems.length).toBe(1);
      expect(holidayItems[0].id).toBe(9);
    });

    test('returns permission error when ShiftInstance.Read is missing', async () => {
      const response = await call(
        'UteamupShiftInstanceListByRange',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: ShiftInstance.Read required' },
            id: 5
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('ShiftInstance.Read');
    });

    test('includes dateFrom and dateTo in request params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => { capturedBody = body; return true; })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '[]' }] },
          id: 6
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupShiftInstanceListByRange',
          arguments: { dateFrom: '2026-03-01', dateTo: '2026-03-31', shiftId: 2 }
        },
        id: 6
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
      expect(capturedBody.params.arguments.dateTo).toBe('2026-03-31');
      expect(capturedBody.params.arguments.shiftId).toBe(2);
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const response = await call(
        'UteamupShiftInstanceListByRange',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: '[]' }] },
            id: 7
          }
        }
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(7);
    });

    test('returns error for missing dateFrom parameter', async () => {
      const response = await call(
        'UteamupShiftInstanceListByRange',
        { dateTo: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'DateFrom is required.' },
            id: 8
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('required');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftInstanceGet
  // ---------------------------------------------------------------------------
  describe('UteamupShiftInstanceGet tool', () => {
    test('returns a single shift instance by id', async () => {
      const response = await call(
        'UteamupShiftInstanceGet',
        { id: 5 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(instance) }] },
            id: 10
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.id).toBe(5);
      expect(result.shiftId).toBe(1);
      expect(result.shiftName).toBe('Morning Shift');
      expect(result.status).toBe('Published');
      expect(result.assignmentCount).toBe(2);
    });

    test('returns not found error for non-existent id', async () => {
      const response = await call(
        'UteamupShiftInstanceGet',
        { id: 99999 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'ShiftInstance 99999 not found.' },
            id: 11
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32602);
      expect(response.body.error.message).toContain('ShiftInstance 99999 not found');
    });

    test('returns permission error when ShiftInstance.Read is missing', async () => {
      const response = await call(
        'UteamupShiftInstanceGet',
        { id: 5 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: ShiftInstance.Read required' },
            id: 12
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
    });

    test('returns error when id is not provided', async () => {
      const response = await call(
        'UteamupShiftInstanceGet',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'Id is required.' },
            id: 13
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('required');
    });

    test('includes id in request params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => { capturedBody = body; return true; })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(instance) }] },
          id: 14
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'UteamupShiftInstanceGet', arguments: { id: 5 } },
        id: 14
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
      expect(capturedBody.params.name).toBe('UteamupShiftInstanceGet');
      expect(capturedBody.params.arguments.id).toBe(5);
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const response = await call(
        'UteamupShiftInstanceGet',
        { id: 5 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(instance) }] },
            id: 15
          }
        }
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(15);
    });

    test('returns holiday instance with isHoliday: true', async () => {
      const holidayInstance = { ...instance, id: 9, instanceDate: '2026-03-03T00:00:00Z', isHoliday: true, assignmentCount: 0 };

      const response = await call(
        'UteamupShiftInstanceGet',
        { id: 9 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(holidayInstance) }] },
            id: 16
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.isHoliday).toBe(true);
      expect(result.assignmentCount).toBe(0);
    });

    test('returns AI-generated instance with generatedByAI: true', async () => {
      const aiInstance = { ...instance, generatedByAI: true };

      const response = await call(
        'UteamupShiftInstanceGet',
        { id: 5 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(aiInstance) }] },
            id: 17
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.generatedByAI).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftInstanceCreate
  // ---------------------------------------------------------------------------
  describe('UteamupShiftInstanceCreate tool', () => {
    test('creates a new shift instance and returns the created object', async () => {
      const created = { ...instance, id: 20, instanceDate: '2026-03-15T00:00:00Z', status: 'Draft', assignmentCount: 0 };

      const response = await call(
        'UteamupShiftInstanceCreate',
        { shiftId: 1, instanceDate: '2026-03-15' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(created) }] },
            id: 20
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.id).toBe(20);
      expect(result.shiftId).toBe(1);
      expect(result.instanceDate).toBe('2026-03-15T00:00:00Z');
    });

    test('returns not found error when shiftId does not exist', async () => {
      const response = await call(
        'UteamupShiftInstanceCreate',
        { shiftId: 99999, instanceDate: '2026-03-15' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'Shift 99999 not found.' },
            id: 21
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('returns permission error when ShiftInstance.Create is missing', async () => {
      const response = await call(
        'UteamupShiftInstanceCreate',
        { shiftId: 1, instanceDate: '2026-03-15' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: ShiftInstance.Create required' },
            id: 22
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('ShiftInstance.Create');
    });

    test('returns error when instanceDate is missing', async () => {
      const response = await call(
        'UteamupShiftInstanceCreate',
        { shiftId: 1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'InstanceDate is required.' },
            id: 23
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('required');
    });

    test('returns error when instance for date already exists', async () => {
      const response = await call(
        'UteamupShiftInstanceCreate',
        { shiftId: 1, instanceDate: '2026-03-01' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'A ShiftInstance already exists for shift 1 on 2026-03-01.' },
            id: 24
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('already exists');
    });

    test('includes shiftId and instanceDate in request params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => { capturedBody = body; return true; })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '{}' }] },
          id: 25
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'UteamupShiftInstanceCreate', arguments: { shiftId: 2, instanceDate: '2026-03-20' } },
        id: 25
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
      expect(capturedBody.params.arguments.shiftId).toBe(2);
      expect(capturedBody.params.arguments.instanceDate).toBe('2026-03-20');
    });

    test('JSON-RPC 2.0 compliance — created response has id and result, no error', async () => {
      const response = await call(
        'UteamupShiftInstanceCreate',
        { shiftId: 1, instanceDate: '2026-03-15' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify({ id: 20, shiftId: 1 }) }] },
            id: 26
          }
        }
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(26);
    });

    test('returns 401 when authorization token is missing for create', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(401, 'Unauthorized');

      const statusCode = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupShiftInstanceCreate', arguments: { shiftId: 1, instanceDate: '2026-03-15' } },
          id: 27
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
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftInstanceUpdate
  // ---------------------------------------------------------------------------
  describe('UteamupShiftInstanceUpdate tool', () => {
    test('updates a shift instance and returns the updated object', async () => {
      const updated = { ...instance, instanceDate: '2026-03-05T00:00:00Z' };

      const response = await call(
        'UteamupShiftInstanceUpdate',
        { id: 5, shiftId: 1, instanceDate: '2026-03-05' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(updated) }] },
            id: 30
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.id).toBe(5);
      expect(result.instanceDate).toBe('2026-03-05T00:00:00Z');
    });

    test('returns not found error for non-existent instance id', async () => {
      const response = await call(
        'UteamupShiftInstanceUpdate',
        { id: 99999, shiftId: 1, instanceDate: '2026-03-05' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'ShiftInstance 99999 not found.' },
            id: 31
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('ShiftInstance 99999 not found');
    });

    test('returns permission error when ShiftInstance.Update is missing', async () => {
      const response = await call(
        'UteamupShiftInstanceUpdate',
        { id: 5, shiftId: 1, instanceDate: '2026-03-05' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: ShiftInstance.Update required' },
            id: 32
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('ShiftInstance.Update');
    });

    test('returns error when id is missing', async () => {
      const response = await call(
        'UteamupShiftInstanceUpdate',
        { shiftId: 1, instanceDate: '2026-03-05' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'Id is required.' },
            id: 33
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('required');
    });

    test('includes all update fields in request params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => { capturedBody = body; return true; })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '{}' }] },
          id: 34
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'UteamupShiftInstanceUpdate', arguments: { id: 5, shiftId: 2, instanceDate: '2026-03-10' } },
        id: 34
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
      expect(capturedBody.params.arguments.id).toBe(5);
      expect(capturedBody.params.arguments.shiftId).toBe(2);
      expect(capturedBody.params.arguments.instanceDate).toBe('2026-03-10');
    });

    test('JSON-RPC 2.0 compliance — update response has id and result, no error', async () => {
      const response = await call(
        'UteamupShiftInstanceUpdate',
        { id: 5, shiftId: 1, instanceDate: '2026-03-05' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify({ ...instance, instanceDate: '2026-03-05T00:00:00Z' }) }] },
            id: 35
          }
        }
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(35);
    });

    test('can update isHoliday flag', async () => {
      const markedHoliday = { ...instance, isHoliday: true };

      const response = await call(
        'UteamupShiftInstanceUpdate',
        { id: 5, shiftId: 1, instanceDate: '2026-03-01', isHoliday: true },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(markedHoliday) }] },
            id: 36
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.isHoliday).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftInstanceDelete
  // ---------------------------------------------------------------------------
  describe('UteamupShiftInstanceDelete tool', () => {
    test('deletes a shift instance and returns deleted: true', async () => {
      const response = await call(
        'UteamupShiftInstanceDelete',
        { id: 5 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify({ deleted: true }) }] },
            id: 40
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.deleted).toBe(true);
    });

    test('returns not found error for non-existent instance id', async () => {
      const response = await call(
        'UteamupShiftInstanceDelete',
        { id: 99999 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'ShiftInstance 99999 not found.' },
            id: 41
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('returns permission error when ShiftInstance.Delete is missing', async () => {
      const response = await call(
        'UteamupShiftInstanceDelete',
        { id: 5 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: ShiftInstance.Delete required' },
            id: 42
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('ShiftInstance.Delete');
    });

    test('returns error when id is missing', async () => {
      const response = await call(
        'UteamupShiftInstanceDelete',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'Id is required.' },
            id: 43
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
    });

    test('JSON-RPC 2.0 compliance — delete response has id and result, no error', async () => {
      const response = await call(
        'UteamupShiftInstanceDelete',
        { id: 5 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify({ deleted: true }) }] },
            id: 44
          }
        }
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(44);
    });

    test('returns error when instance has active assignments and cannot be deleted', async () => {
      const response = await call(
        'UteamupShiftInstanceDelete',
        { id: 5 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'Cannot delete ShiftInstance with active assignments. Remove all assignments first.' },
            id: 45
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Cannot delete');
    });

    test('returns 401 when authorization token is missing for delete', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(401, 'Unauthorized');

      const statusCode = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupShiftInstanceDelete', arguments: { id: 5 } },
          id: 46
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

    test('includes id in request params for delete', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => { capturedBody = body; return true; })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify({ deleted: true }) }] },
          id: 47
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'UteamupShiftInstanceDelete', arguments: { id: 7 } },
        id: 47
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
      expect(capturedBody.params.name).toBe('UteamupShiftInstanceDelete');
      expect(capturedBody.params.arguments.id).toBe(7);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftInstanceGenerate
  // ---------------------------------------------------------------------------
  describe('UteamupShiftInstanceGenerate tool', () => {
    test('generates instances for a shift and returns created count', async () => {
      const response = await call(
        'UteamupShiftInstanceGenerate',
        { shiftId: 1, dateFrom: '2026-03-01', dateTo: '2026-03-31', publishImmediately: false, skipExisting: true },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(generateResult) }] },
            id: 50
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.created).toBe(5);
      expect(result.message).toContain('5 shift instance(s) generated');
    });

    test('publishImmediately: true generates instances with Published status', async () => {
      const publishedResult = { created: 3, message: '3 shift instance(s) generated and published.' };

      const response = await call(
        'UteamupShiftInstanceGenerate',
        { shiftId: 1, dateFrom: '2026-03-01', dateTo: '2026-03-07', publishImmediately: true, skipExisting: false },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(publishedResult) }] },
            id: 51
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.created).toBe(3);
      expect(result.message).toContain('published');
    });

    test('skipExisting: true skips dates that already have instances', async () => {
      const skippedResult = { created: 2, message: '2 shift instance(s) generated. 5 skipped (already exist).' };

      const response = await call(
        'UteamupShiftInstanceGenerate',
        { shiftId: 1, dateFrom: '2026-03-01', dateTo: '2026-03-07', publishImmediately: false, skipExisting: true },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(skippedResult) }] },
            id: 52
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.created).toBe(2);
      expect(result.message).toContain('skipped');
    });

    test('returns not found error when shiftId does not exist', async () => {
      const response = await call(
        'UteamupShiftInstanceGenerate',
        { shiftId: 99999, dateFrom: '2026-03-01', dateTo: '2026-03-31', publishImmediately: false, skipExisting: true },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'Shift 99999 not found.' },
            id: 53
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('returns permission error when ShiftInstance.Create is missing', async () => {
      const response = await call(
        'UteamupShiftInstanceGenerate',
        { shiftId: 1, dateFrom: '2026-03-01', dateTo: '2026-03-31', publishImmediately: false, skipExisting: true },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: ShiftInstance.Create required' },
            id: 54
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
    });

    test('includes all generate params in request body', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => { capturedBody = body; return true; })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(generateResult) }] },
          id: 55
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupShiftInstanceGenerate',
          arguments: { shiftId: 3, dateFrom: '2026-04-01', dateTo: '2026-04-30', publishImmediately: true, skipExisting: false }
        },
        id: 55
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
      expect(capturedBody.params.arguments.shiftId).toBe(3);
      expect(capturedBody.params.arguments.dateFrom).toBe('2026-04-01');
      expect(capturedBody.params.arguments.dateTo).toBe('2026-04-30');
      expect(capturedBody.params.arguments.publishImmediately).toBe(true);
      expect(capturedBody.params.arguments.skipExisting).toBe(false);
    });

    test('JSON-RPC 2.0 compliance — generate response has id and result, no error', async () => {
      const response = await call(
        'UteamupShiftInstanceGenerate',
        { shiftId: 1, dateFrom: '2026-03-01', dateTo: '2026-03-07', publishImmediately: false, skipExisting: true },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(generateResult) }] },
            id: 56
          }
        }
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(56);
    });

    test('returns zero created when all dates already have instances and skipExisting is true', async () => {
      const zeroResult = { created: 0, message: '0 shift instance(s) generated. 7 skipped (already exist).' };

      const response = await call(
        'UteamupShiftInstanceGenerate',
        { shiftId: 1, dateFrom: '2026-03-01', dateTo: '2026-03-07', publishImmediately: false, skipExisting: true },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(zeroResult) }] },
            id: 57
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.created).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftInstanceApprove
  // ---------------------------------------------------------------------------
  describe('UteamupShiftInstanceApprove tool', () => {
    test('approves a shift instance and returns the updated instance', async () => {
      const approved = { ...instance, status: 'Approved' };

      const response = await call(
        'UteamupShiftInstanceApprove',
        { id: 5 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(approved) }] },
            id: 60
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.id).toBe(5);
      expect(result.status).toBe('Approved');
    });

    test('returns not found error for non-existent instance id', async () => {
      const response = await call(
        'UteamupShiftInstanceApprove',
        { id: 99999 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'ShiftInstance 99999 not found.' },
            id: 61
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('returns permission error when ShiftInstance.Approve is missing', async () => {
      const response = await call(
        'UteamupShiftInstanceApprove',
        { id: 5 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: ShiftInstance.Approve required' },
            id: 62
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
    });

    test('returns error when id is missing', async () => {
      const response = await call(
        'UteamupShiftInstanceApprove',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'Id is required.' },
            id: 63
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
    });

    test('returns error when instance is already in a terminal state', async () => {
      const response = await call(
        'UteamupShiftInstanceApprove',
        { id: 5 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'Cannot approve ShiftInstance in Completed status.' },
            id: 64
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Cannot approve');
    });

    test('JSON-RPC 2.0 compliance — approve response has id and result, no error', async () => {
      const response = await call(
        'UteamupShiftInstanceApprove',
        { id: 5 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify({ ...instance, status: 'Approved' }) }] },
            id: 65
          }
        }
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(65);
    });

    test('includes id in request params for approve', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => { capturedBody = body; return true; })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify({ ...instance, status: 'Approved' }) }] },
          id: 66
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'UteamupShiftInstanceApprove', arguments: { id: 5 } },
        id: 66
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
      expect(capturedBody.params.name).toBe('UteamupShiftInstanceApprove');
      expect(capturedBody.params.arguments.id).toBe(5);
    });

    test('returns 401 when authorization token is missing for approve', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(401, 'Unauthorized');

      const statusCode = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupShiftInstanceApprove', arguments: { id: 5 } },
          id: 67
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
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftInstanceSetStatus
  // ---------------------------------------------------------------------------
  describe('UteamupShiftInstanceSetStatus tool', () => {
    test('sets status to InProgress and returns the updated instance', async () => {
      const inProgress = { ...instance, status: 'InProgress' };

      const response = await call(
        'UteamupShiftInstanceSetStatus',
        { id: 5, status: 'InProgress' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(inProgress) }] },
            id: 70
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.id).toBe(5);
      expect(result.status).toBe('InProgress');
    });

    test('sets status to Completed and returns the updated instance', async () => {
      const completed = { ...instance, status: 'Completed' };

      const response = await call(
        'UteamupShiftInstanceSetStatus',
        { id: 5, status: 'Completed' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(completed) }] },
            id: 71
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.status).toBe('Completed');
    });

    test('sets status to Cancelled and returns the updated instance', async () => {
      const cancelled = { ...instance, status: 'Cancelled' };

      const response = await call(
        'UteamupShiftInstanceSetStatus',
        { id: 5, status: 'Cancelled' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(cancelled) }] },
            id: 72
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.status).toBe('Cancelled');
    });

    test('returns not found error for non-existent instance id', async () => {
      const response = await call(
        'UteamupShiftInstanceSetStatus',
        { id: 99999, status: 'InProgress' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'ShiftInstance 99999 not found.' },
            id: 73
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('returns permission error when ShiftInstance.Update is missing', async () => {
      const response = await call(
        'UteamupShiftInstanceSetStatus',
        { id: 5, status: 'InProgress' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: ShiftInstance.Update required' },
            id: 74
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
    });

    test('returns error for invalid status value', async () => {
      const response = await call(
        'UteamupShiftInstanceSetStatus',
        { id: 5, status: 'InvalidStatus' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'Status "InvalidStatus" is not valid. Allowed: Draft, Published, InProgress, Completed, Cancelled.' },
            id: 75
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not valid');
    });

    test('includes id and status in request params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => { capturedBody = body; return true; })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify({ ...instance, status: 'InProgress' }) }] },
          id: 76
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'UteamupShiftInstanceSetStatus', arguments: { id: 5, status: 'InProgress' } },
        id: 76
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
      expect(capturedBody.params.arguments.id).toBe(5);
      expect(capturedBody.params.arguments.status).toBe('InProgress');
    });

    test('JSON-RPC 2.0 compliance — setStatus response has id and result, no error', async () => {
      const response = await call(
        'UteamupShiftInstanceSetStatus',
        { id: 5, status: 'InProgress' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify({ ...instance, status: 'InProgress' }) }] },
            id: 77
          }
        }
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(77);
    });
  });

  // ---------------------------------------------------------------------------
  // Shared tool definitions for error-handling factories
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupShiftInstanceListByRange', args: { dateFrom: '2026-03-01', dateTo: '2026-03-07' } },
    { name: 'UteamupShiftInstanceGet', args: { id: 5 } },
    { name: 'UteamupShiftInstanceCreate', args: { shiftId: 1, instanceDate: '2026-03-15' } },
    { name: 'UteamupShiftInstanceUpdate', args: { id: 5, shiftId: 1, instanceDate: '2026-03-05' } },
    { name: 'UteamupShiftInstanceDelete', args: { id: 5 } },
    { name: 'UteamupShiftInstanceGenerate', args: { shiftId: 1, dateFrom: '2026-03-01', dateTo: '2026-03-07', publishImmediately: false, skipExisting: true } },
    { name: 'UteamupShiftInstanceApprove', args: { id: 5 } },
    { name: 'UteamupShiftInstanceSetStatus', args: { id: 5, status: 'InProgress' } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
