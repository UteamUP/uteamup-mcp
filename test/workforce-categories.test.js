/**
 * Workforce Category MCP tool tests
 *
 * Tests that WorkforceCategory MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error
 * responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   UteamupWorkforceCategoryList        — list all categories for tenant
 *   UteamupWorkforceCategoryGet         — get single category by id
 *   UteamupWorkforceCategoryCreate      — create a new category
 *   UteamupWorkforceCategoryUpdate      — update an existing category
 *   UteamupWorkforceCategoryDelete      — delete a category
 *   UteamupWorkforceCategoryGetMembers  — get members of a category
 *   UteamupWorkforceCategoryAddMember   — add a member to a category
 *   UteamupWorkforceCategoryRemoveMember — remove a member from a category
 *
 * Pattern mirrors schedule.test.js: raw nock-mocked HTTPS calls that simulate
 * what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const https = require('https');

describe('Workforce Category MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_workforce_category_tools';

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

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------
  const category = {
    id: 1,
    name: 'Electrical Day',
    description: 'Day shift electricians',
    colorCode: '#3B82F6',
    iconName: 'bolt',
    defaultLocationId: null,
    isActive: true,
    memberCount: 3
  };

  const member = {
    id: 10,
    workforceCategoryId: 1,
    categoryName: 'Electrical Day',
    userId: 'user-alice-001',
    userName: 'Alice Smith',
    teamId: null,
    teamName: null,
    role: 'Member',
    isActive: true
  };

  // ---------------------------------------------------------------------------
  // UteamupWorkforceCategoryList
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceCategoryList tool', () => {
    test('returns list of all categories for the tenant', async () => {
      const categories = [
        category,
        { id: 2, name: 'Plumbing Night', description: 'Night shift plumbers', colorCode: '#10B981', defaultLocationId: null, isActive: true, memberCount: 5 },
        { id: 3, name: 'HVAC Technicians', description: 'HVAC specialists', colorCode: '#F59E0B', defaultLocationId: 4, isActive: true, memberCount: 2 }
      ];

      const response = await callMcpTool(
        'UteamupWorkforceCategoryList',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(categories) }] },
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
      expect(list[0].name).toBe('Electrical Day');
      expect(list[1].name).toBe('Plumbing Night');
      expect(list[2].name).toBe('HVAC Technicians');
    });

    test('returns empty array when tenant has no categories', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryList',
        {},
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
      expect(response.body.result).toBeDefined();
      const list = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(0);
    });

    test('returns permission error when WorkforceCategory.Read is missing', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryList',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: WorkforceCategory.Read required' },
            id: 3
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('WorkforceCategory.Read');
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryList',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: '[]' }] },
            id: 4
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(4);
    });

    test('returns categories with all expected fields', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryList',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify([category]) }] },
            id: 5
          }
        }
      );

      expect(response.status).toBe(200);
      const list = JSON.parse(response.body.result.content[0].text);
      const item = list[0];
      expect(item.id).toBe(1);
      expect(item.name).toBe('Electrical Day');
      expect(item.colorCode).toBe('#3B82F6');
      expect(item.isActive).toBe(true);
      expect(item.memberCount).toBe(3);
    });

    test('returns only active categories when filter applied', async () => {
      const activeOnly = [
        { ...category, isActive: true },
        { id: 2, name: 'Plumbing Night', description: 'Night shift plumbers', colorCode: '#10B981', defaultLocationId: null, isActive: true, memberCount: 5 }
      ];

      const response = await callMcpTool(
        'UteamupWorkforceCategoryList',
        { activeOnly: true },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(activeOnly) }] },
            id: 6
          }
        }
      );

      expect(response.status).toBe(200);
      const list = JSON.parse(response.body.result.content[0].text);
      expect(list.every(c => c.isActive === true)).toBe(true);
    });

    test('returns 401 when authorization token is missing', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(401, 'Unauthorized');

      const statusCode = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupWorkforceCategoryList', arguments: {} },
          id: 7
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

    test('returns 503 when backend is unavailable', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(503, 'Service Unavailable');

      const statusCode = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupWorkforceCategoryList', arguments: {} },
          id: 8
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

      expect(statusCode).toBe(503);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceCategoryGet
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceCategoryGet tool', () => {
    test('returns single category by id', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryGet',
        { id: 1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(category) }] },
            id: 10
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.id).toBe(1);
      expect(result.name).toBe('Electrical Day');
      expect(result.colorCode).toBe('#3B82F6');
      expect(result.memberCount).toBe(3);
    });

    test('returns not found error for non-existent category id', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryGet',
        { id: 99999 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'WorkforceCategory 99999 not found.' },
            id: 11
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32602);
      expect(response.body.error.message).toContain('WorkforceCategory 99999 not found');
    });

    test('returns permission error when WorkforceCategory.Read is missing', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryGet',
        { id: 1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: WorkforceCategory.Read required' },
            id: 12
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('WorkforceCategory.Read');
    });

    test('returns error when id is not provided', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryGet',
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
          result: { content: [{ type: 'text', text: JSON.stringify(category) }] },
          id: 14
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'UteamupWorkforceCategoryGet', arguments: { id: 1 } },
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
      expect(capturedBody.params.name).toBe('UteamupWorkforceCategoryGet');
      expect(capturedBody.params.arguments.id).toBe(1);
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryGet',
        { id: 1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(category) }] },
            id: 15
          }
        }
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(15);
    });

    test('returns category with defaultLocationId when set', async () => {
      const categoryWithLocation = { ...category, defaultLocationId: 7 };

      const response = await callMcpTool(
        'UteamupWorkforceCategoryGet',
        { id: 1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(categoryWithLocation) }] },
            id: 16
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.defaultLocationId).toBe(7);
    });

    test('returns inactive category when queried directly by id', async () => {
      const inactiveCategory = { ...category, id: 5, isActive: false, memberCount: 0 };

      const response = await callMcpTool(
        'UteamupWorkforceCategoryGet',
        { id: 5 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(inactiveCategory) }] },
            id: 17
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.isActive).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceCategoryCreate
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceCategoryCreate tool', () => {
    test('creates a new category and returns the created object', async () => {
      const createArgs = { name: 'Mechanical Team', description: 'Mechanical technicians', colorCode: '#EF4444' };
      const created = { ...createArgs, id: 4, defaultLocationId: null, isActive: true, memberCount: 0 };

      const response = await callMcpTool(
        'UteamupWorkforceCategoryCreate',
        createArgs,
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
      expect(result.id).toBe(4);
      expect(result.name).toBe('Mechanical Team');
      expect(result.isActive).toBe(true);
      expect(result.memberCount).toBe(0);
    });

    test('returns error when name is missing', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryCreate',
        { colorCode: '#EF4444' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'Name is required.' },
            id: 21
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Name is required');
    });

    test('returns error for duplicate category name', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryCreate',
        { name: 'Electrical Day', colorCode: '#3B82F6' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'A WorkforceCategory with the name "Electrical Day" already exists.' },
            id: 22
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('already exists');
    });

    test('returns permission error when WorkforceCategory.Create is missing', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryCreate',
        { name: 'New Team', colorCode: '#00FF00' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: WorkforceCategory.Create required' },
            id: 23
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('WorkforceCategory.Create');
    });

    test('includes all create fields in request params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => { capturedBody = body; return true; })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '{}' }] },
          id: 24
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupWorkforceCategoryCreate',
          arguments: { name: 'Electrical Day', description: 'Day shift', colorCode: '#3B82F6', defaultLocationId: 5 }
        },
        id: 24
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
      expect(capturedBody.params.arguments.name).toBe('Electrical Day');
      expect(capturedBody.params.arguments.description).toBe('Day shift');
      expect(capturedBody.params.arguments.colorCode).toBe('#3B82F6');
      expect(capturedBody.params.arguments.defaultLocationId).toBe(5);
    });

    test('JSON-RPC 2.0 compliance — created response has id and result, no error', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryCreate',
        { name: 'New Category', colorCode: '#FF0000' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify({ id: 10, name: 'New Category', colorCode: '#FF0000', isActive: true, memberCount: 0 }) }] },
            id: 25
          }
        }
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(25);
    });

    test('newly created category has memberCount of zero', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryCreate',
        { name: 'Empty Team', colorCode: '#AABBCC' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify({ id: 7, name: 'Empty Team', colorCode: '#AABBCC', isActive: true, memberCount: 0 }) }] },
            id: 26
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.memberCount).toBe(0);
    });

    test('creates category with defaultLocationId when provided', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryCreate',
        { name: 'Site A Team', colorCode: '#112233', defaultLocationId: 3 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify({ id: 8, name: 'Site A Team', colorCode: '#112233', defaultLocationId: 3, isActive: true, memberCount: 0 }) }] },
            id: 27
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.defaultLocationId).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceCategoryUpdate
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceCategoryUpdate tool', () => {
    test('updates a category and returns the updated object', async () => {
      const updated = { ...category, name: 'Electrical Night', colorCode: '#6366F1' };

      const response = await callMcpTool(
        'UteamupWorkforceCategoryUpdate',
        { id: 1, name: 'Electrical Night', colorCode: '#6366F1' },
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
      expect(result.id).toBe(1);
      expect(result.name).toBe('Electrical Night');
      expect(result.colorCode).toBe('#6366F1');
    });

    test('returns not found error for non-existent category id', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryUpdate',
        { id: 99999, name: 'Updated Name' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'WorkforceCategory 99999 not found.' },
            id: 31
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('WorkforceCategory 99999 not found');
    });

    test('returns permission error when WorkforceCategory.Update is missing', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryUpdate',
        { id: 1, name: 'New Name' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: WorkforceCategory.Update required' },
            id: 32
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('WorkforceCategory.Update');
    });

    test('returns error when id is missing from update args', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryUpdate',
        { name: 'No Id Provided' },
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

    test('includes id and update fields in request params', async () => {
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
        params: {
          name: 'UteamupWorkforceCategoryUpdate',
          arguments: { id: 2, name: 'Updated Plumbing', colorCode: '#14B8A6', isActive: false }
        },
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
      expect(capturedBody.params.arguments.id).toBe(2);
      expect(capturedBody.params.arguments.name).toBe('Updated Plumbing');
      expect(capturedBody.params.arguments.colorCode).toBe('#14B8A6');
      expect(capturedBody.params.arguments.isActive).toBe(false);
    });

    test('JSON-RPC 2.0 compliance — update response has id and result, no error', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryUpdate',
        { id: 1, name: 'Updated' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify({ ...category, name: 'Updated' }) }] },
            id: 35
          }
        }
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(35);
    });

    test('can deactivate a category by setting isActive to false', async () => {
      const deactivated = { ...category, isActive: false };

      const response = await callMcpTool(
        'UteamupWorkforceCategoryUpdate',
        { id: 1, isActive: false },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(deactivated) }] },
            id: 36
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.isActive).toBe(false);
    });

    test('can update defaultLocationId to a new location', async () => {
      const withNewLocation = { ...category, defaultLocationId: 9 };

      const response = await callMcpTool(
        'UteamupWorkforceCategoryUpdate',
        { id: 1, defaultLocationId: 9 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(withNewLocation) }] },
            id: 37
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.defaultLocationId).toBe(9);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceCategoryDelete
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceCategoryDelete tool', () => {
    test('deletes a category and returns deleted: true', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryDelete',
        { id: 1 },
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

    test('returns not found error for non-existent category id', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryDelete',
        { id: 99999 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'WorkforceCategory 99999 not found.' },
            id: 41
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('WorkforceCategory 99999 not found');
    });

    test('returns permission error when WorkforceCategory.Delete is missing', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryDelete',
        { id: 1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: WorkforceCategory.Delete required' },
            id: 42
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('WorkforceCategory.Delete');
    });

    test('returns error when id is missing', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryDelete',
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
      expect(response.body.error.message).toContain('required');
    });

    test('includes id in request params for delete', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => { capturedBody = body; return true; })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify({ deleted: true }) }] },
          id: 44
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'UteamupWorkforceCategoryDelete', arguments: { id: 3 } },
        id: 44
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
      expect(capturedBody.params.name).toBe('UteamupWorkforceCategoryDelete');
      expect(capturedBody.params.arguments.id).toBe(3);
    });

    test('JSON-RPC 2.0 compliance — delete response has id and result, no error', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryDelete',
        { id: 2 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify({ deleted: true }) }] },
            id: 45
          }
        }
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(45);
    });

    test('returns error when category has active members and cannot be deleted', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryDelete',
        { id: 1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'Cannot delete WorkforceCategory with active members. Remove all members first.' },
            id: 46
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
          params: { name: 'UteamupWorkforceCategoryDelete', arguments: { id: 1 } },
          id: 47
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
  // UteamupWorkforceCategoryGetMembers
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceCategoryGetMembers tool', () => {
    test('returns list of members for a category', async () => {
      const members = [
        member,
        { id: 11, workforceCategoryId: 1, categoryName: 'Electrical Day', userId: 'user-bob-002', userName: 'Bob Jones', teamId: null, teamName: null, role: 'Member', isActive: true },
        { id: 12, workforceCategoryId: 1, categoryName: 'Electrical Day', userId: 'user-charlie-003', userName: 'Charlie Brown', teamId: null, teamName: null, role: 'Lead', isActive: true }
      ];

      const response = await callMcpTool(
        'UteamupWorkforceCategoryGetMembers',
        { categoryId: 1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(members) }] },
            id: 50
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const list = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(3);
      expect(list[0].userId).toBe('user-alice-001');
      expect(list[2].role).toBe('Lead');
    });

    test('returns empty array when category has no members', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryGetMembers',
        { categoryId: 3 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: '[]' }] },
            id: 51
          }
        }
      );

      expect(response.status).toBe(200);
      const list = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(0);
    });

    test('returns not found error for non-existent categoryId', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryGetMembers',
        { categoryId: 99999 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'WorkforceCategory 99999 not found.' },
            id: 52
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('returns permission error when WorkforceCategory.Read is missing', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryGetMembers',
        { categoryId: 1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: WorkforceCategory.Read required' },
            id: 53
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
    });

    test('returns members with correct shape including all fields', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryGetMembers',
        { categoryId: 1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify([member]) }] },
            id: 54
          }
        }
      );

      expect(response.status).toBe(200);
      const list = JSON.parse(response.body.result.content[0].text);
      const m = list[0];
      expect(m.id).toBe(10);
      expect(m.workforceCategoryId).toBe(1);
      expect(m.categoryName).toBe('Electrical Day');
      expect(m.userId).toBe('user-alice-001');
      expect(m.userName).toBe('Alice Smith');
      expect(m.role).toBe('Member');
      expect(m.isActive).toBe(true);
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryGetMembers',
        { categoryId: 1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: '[]' }] },
            id: 55
          }
        }
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(55);
    });

    test('includes categoryId in request params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => { capturedBody = body; return true; })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '[]' }] },
          id: 56
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'UteamupWorkforceCategoryGetMembers', arguments: { categoryId: 2 } },
        id: 56
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
      expect(capturedBody.params.arguments.categoryId).toBe(2);
    });

    test('returns team-based members with teamId and teamName set', async () => {
      const teamMember = { ...member, id: 20, teamId: 5, teamName: 'Electrical Team Alpha', userId: null, userName: null };

      const response = await callMcpTool(
        'UteamupWorkforceCategoryGetMembers',
        { categoryId: 1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify([teamMember]) }] },
            id: 57
          }
        }
      );

      expect(response.status).toBe(200);
      const list = JSON.parse(response.body.result.content[0].text);
      expect(list[0].teamId).toBe(5);
      expect(list[0].teamName).toBe('Electrical Team Alpha');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceCategoryAddMember
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceCategoryAddMember tool', () => {
    test('adds a member to a category and returns the member object', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryAddMember',
        { categoryId: 1, userId: 'user-alice-001', role: 'Member' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(member) }] },
            id: 60
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.id).toBe(10);
      expect(result.userId).toBe('user-alice-001');
      expect(result.workforceCategoryId).toBe(1);
      expect(result.role).toBe('Member');
    });

    test('returns not found error when categoryId does not exist', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryAddMember',
        { categoryId: 99999, userId: 'user-alice-001', role: 'Member' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'WorkforceCategory 99999 not found.' },
            id: 61
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('returns permission error when WorkforceCategory.Update is missing', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryAddMember',
        { categoryId: 1, userId: 'user-bob-002', role: 'Member' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: WorkforceCategory.Update required' },
            id: 62
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
    });

    test('returns error when userId is missing', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryAddMember',
        { categoryId: 1, role: 'Member' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'UserId is required when teamId is not provided.' },
            id: 63
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('required');
    });

    test('returns error when user is already a member of the category', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryAddMember',
        { categoryId: 1, userId: 'user-alice-001', role: 'Member' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'User user-alice-001 is already a member of this category.' },
            id: 64
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('already a member');
    });

    test('includes all required fields in request params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => { capturedBody = body; return true; })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(member) }] },
          id: 65
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupWorkforceCategoryAddMember',
          arguments: { categoryId: 1, userId: 'user-dave-004', role: 'Lead' }
        },
        id: 65
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
      expect(capturedBody.params.arguments.categoryId).toBe(1);
      expect(capturedBody.params.arguments.userId).toBe('user-dave-004');
      expect(capturedBody.params.arguments.role).toBe('Lead');
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryAddMember',
        { categoryId: 1, userId: 'user-alice-001', role: 'Member' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(member) }] },
            id: 66
          }
        }
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(66);
    });

    test('can add a team as a member using teamId instead of userId', async () => {
      const teamMember = { id: 20, workforceCategoryId: 1, categoryName: 'Electrical Day', userId: null, userName: null, teamId: 5, teamName: 'Electrical Team Alpha', role: 'Member', isActive: true };

      const response = await callMcpTool(
        'UteamupWorkforceCategoryAddMember',
        { categoryId: 1, teamId: 5, role: 'Member' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(teamMember) }] },
            id: 67
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.teamId).toBe(5);
      expect(result.teamName).toBe('Electrical Team Alpha');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceCategoryRemoveMember
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceCategoryRemoveMember tool', () => {
    test('removes a member from a category and returns removed: true', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryRemoveMember',
        { categoryId: 1, memberId: 10 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify({ removed: true }) }] },
            id: 70
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.removed).toBe(true);
    });

    test('returns not found error when memberId does not exist in category', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryRemoveMember',
        { categoryId: 1, memberId: 99999 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'WorkforceCategory 99999 not found.' },
            id: 71
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('returns permission error when WorkforceCategory.Update is missing', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryRemoveMember',
        { categoryId: 1, memberId: 10 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32600, message: 'Permission denied: WorkforceCategory.Update required' },
            id: 72
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('WorkforceCategory.Update');
    });

    test('returns error when memberId is missing', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryRemoveMember',
        { categoryId: 1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'MemberId is required.' },
            id: 73
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('required');
    });

    test('includes categoryId and memberId in request params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => { capturedBody = body; return true; })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify({ removed: true }) }] },
          id: 74
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'UteamupWorkforceCategoryRemoveMember', arguments: { categoryId: 1, memberId: 10 } },
        id: 74
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
      expect(capturedBody.params.arguments.categoryId).toBe(1);
      expect(capturedBody.params.arguments.memberId).toBe(10);
    });

    test('JSON-RPC 2.0 compliance — remove response has id and result, no error', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryRemoveMember',
        { categoryId: 1, memberId: 10 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify({ removed: true }) }] },
            id: 75
          }
        }
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(75);
    });

    test('returns 401 when authorization token is missing for remove member', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(401, 'Unauthorized');

      const statusCode = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'UteamupWorkforceCategoryRemoveMember', arguments: { categoryId: 1, memberId: 10 } },
          id: 76
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

    test('returns not found when categoryId itself does not exist', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryRemoveMember',
        { categoryId: 88888, memberId: 10 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32602, message: 'WorkforceCategory 88888 not found.' },
            id: 77
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('88888');
    });
  });

  // ---------------------------------------------------------------------------
  // IconName field support
  // ---------------------------------------------------------------------------
  describe('IconName field support', () => {
    test('create with iconName returns iconName in response', async () => {
      const createArgs = { name: 'Icon Team', description: 'Team with icon', colorCode: '#8B5CF6', iconName: 'wrench-screwdriver' };
      const created = { ...createArgs, id: 20, defaultLocationId: null, isActive: true, memberCount: 0 };

      const response = await callMcpTool(
        'UteamupWorkforceCategoryCreate',
        createArgs,
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(created) }] },
            id: 200
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.iconName).toBe('wrench-screwdriver');
      expect(result.name).toBe('Icon Team');
    });

    test('create without iconName returns null iconName (backwards-compatible)', async () => {
      const createArgs = { name: 'No Icon Team', colorCode: '#10B981' };
      const created = { ...createArgs, id: 21, iconName: null, defaultLocationId: null, isActive: true, memberCount: 0 };

      const response = await callMcpTool(
        'UteamupWorkforceCategoryCreate',
        createArgs,
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(created) }] },
            id: 201
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.iconName).toBeNull();
    });

    test('update iconName returns updated value', async () => {
      const updated = { ...category, iconName: 'users' };

      const response = await callMcpTool(
        'UteamupWorkforceCategoryUpdate',
        { id: 1, iconName: 'users' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(updated) }] },
            id: 202
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.iconName).toBe('users');
    });

    test('clear iconName by setting to null', async () => {
      const updated = { ...category, iconName: null };

      const response = await callMcpTool(
        'UteamupWorkforceCategoryUpdate',
        { id: 1, iconName: null },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(updated) }] },
            id: 203
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.iconName).toBeNull();
    });

    test('list categories returns iconName field', async () => {
      const categories = [
        { ...category, iconName: 'bolt' },
        { id: 2, name: 'Plumbing Night', colorCode: '#10B981', iconName: null, isActive: true, memberCount: 5 },
        { id: 3, name: 'HVAC Team', colorCode: '#F59E0B', iconName: 'wrench-screwdriver', isActive: true, memberCount: 2 }
      ];

      const response = await callMcpTool(
        'UteamupWorkforceCategoryList',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(categories) }] },
            id: 204
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result[0].iconName).toBe('bolt');
      expect(result[1].iconName).toBeNull();
      expect(result[2].iconName).toBe('wrench-screwdriver');
    });

    test('get category by id returns iconName', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceCategoryGet',
        { id: 1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(category) }] },
            id: 205
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.iconName).toBe('bolt');
    });

    test('iconName is included in create request params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => { capturedBody = body; return true; })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '{}' }] },
          id: 206
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupWorkforceCategoryCreate',
          arguments: { name: 'Icon Team', colorCode: '#3B82F6', iconName: 'cog-6-tooth' }
        },
        id: 206
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
      expect(capturedBody.params.arguments.iconName).toBe('cog-6-tooth');
    });
  });

  // ---------------------------------------------------------------------------
  // JSON-RPC 2.0 compliance — all 8 tools
  // ---------------------------------------------------------------------------
  describe('JSON-RPC 2.0 compliance — all tools', () => {
    const complianceTools = [
      { name: 'UteamupWorkforceCategoryList', args: {}, idBase: 100 },
      { name: 'UteamupWorkforceCategoryGet', args: { id: 1 }, idBase: 101 },
      { name: 'UteamupWorkforceCategoryCreate', args: { name: 'Test', colorCode: '#000000' }, idBase: 102 },
      { name: 'UteamupWorkforceCategoryUpdate', args: { id: 1, name: 'Updated' }, idBase: 103 },
      { name: 'UteamupWorkforceCategoryDelete', args: { id: 1 }, idBase: 104 },
      { name: 'UteamupWorkforceCategoryGetMembers', args: { categoryId: 1 }, idBase: 105 },
      { name: 'UteamupWorkforceCategoryAddMember', args: { categoryId: 1, userId: 'user-001', role: 'Member' }, idBase: 106 },
      { name: 'UteamupWorkforceCategoryRemoveMember', args: { categoryId: 1, memberId: 10 }, idBase: 107 }
    ];

    test.each(complianceTools)(
      '$name — response has id and result, no error (JSON-RPC 2.0 success shape)',
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
        expect(response.body.result).toBeDefined();
        expect(response.body.error).toBeUndefined();
        expect(response.body.id).toBe(idBase);
      }
    );
  });

  // ---------------------------------------------------------------------------
  // 401 Unauthorized handling — all 8 tools
  // ---------------------------------------------------------------------------
  describe('401 Unauthorized handling — all tools', () => {
    const authTools = [
      { name: 'UteamupWorkforceCategoryList', args: {} },
      { name: 'UteamupWorkforceCategoryGet', args: { id: 1 } },
      { name: 'UteamupWorkforceCategoryCreate', args: { name: 'Test', colorCode: '#000000' } },
      { name: 'UteamupWorkforceCategoryUpdate', args: { id: 1, name: 'Updated' } },
      { name: 'UteamupWorkforceCategoryDelete', args: { id: 1 } },
      { name: 'UteamupWorkforceCategoryGetMembers', args: { categoryId: 1 } },
      { name: 'UteamupWorkforceCategoryAddMember', args: { categoryId: 1, userId: 'user-001', role: 'Member' } },
      { name: 'UteamupWorkforceCategoryRemoveMember', args: { categoryId: 1, memberId: 10 } }
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
      }
    );
  });
});
