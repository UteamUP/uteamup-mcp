/**
 * WorkorderWatcher MCP tool tests
 *
 * Tests that WorkorderWatcher MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error
 * responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   UteamupWorkorderWatchlistGet(workorderId)
 *   UteamupWorkorderWatcherAdd(workorderId, userId, contactId)
 *   UteamupWorkorderWatcherRemove(workorderId, watcherId)
 *
 * Pattern mirrors contractor-tools.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const https = require('https');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('WorkorderWatcher MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_watchlist';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------
  const mockUserWatcher = {
    id: 1,
    workorderId: 500,
    userId: 'user-abc-123',
    contactId: null,
    watcherName: 'John Doe',
    watcherEmail: 'john.doe@example.com',
    watcherType: 'User',
    createdAt: '2026-03-10T08:00:00Z'
  };

  const mockContactWatcher = {
    id: 2,
    workorderId: 500,
    userId: null,
    contactId: 42,
    watcherName: 'Jane Smith',
    watcherEmail: 'jane.smith@client.com',
    watcherType: 'Contact',
    createdAt: '2026-03-11T09:30:00Z'
  };

  const mockWatcherList = [mockUserWatcher, mockContactWatcher];

  // ---------------------------------------------------------------------------
  // UteamupWorkorderWatchlistGet
  // ---------------------------------------------------------------------------
  describe('UteamupWorkorderWatchlistGet tool', () => {
    test('returns watcher list for a workorder', async () => {
      const response = await call(
        'UteamupWorkorderWatchlistGet',
        { workorderId: 500 },
        successReply(mockWatcherList)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(2);
      expect(data[0].watcherName).toBe('John Doe');
      expect(data[0].watcherType).toBe('User');
      expect(data[1].watcherName).toBe('Jane Smith');
      expect(data[1].watcherType).toBe('Contact');
    });

    test('returns empty list when no watchers exist', async () => {
      const response = await call(
        'UteamupWorkorderWatchlistGet',
        { workorderId: 999 },
        successReply([])
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toEqual([]);
    });

    test('returns error when workorder not found', async () => {
      const response = await call(
        'UteamupWorkorderWatchlistGet',
        { workorderId: 99999 },
        errorReply(-32000, 'Workorder not found')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Workorder not found');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkorderWatcherAdd
  // ---------------------------------------------------------------------------
  describe('UteamupWorkorderWatcherAdd tool', () => {
    test('adds a user watcher to a workorder', async () => {
      const newUserWatcher = { ...mockUserWatcher, id: 3 };

      const response = await call(
        'UteamupWorkorderWatcherAdd',
        { workorderId: 500, userId: 'user-abc-123' },
        successReply(newUserWatcher)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.id).toBe(3);
      expect(data.workorderId).toBe(500);
      expect(data.userId).toBe('user-abc-123');
      expect(data.contactId).toBeNull();
      expect(data.watcherType).toBe('User');
    });

    test('adds a contact watcher to a workorder', async () => {
      const newContactWatcher = { ...mockContactWatcher, id: 4 };

      const response = await call(
        'UteamupWorkorderWatcherAdd',
        { workorderId: 500, contactId: 42 },
        successReply(newContactWatcher)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.id).toBe(4);
      expect(data.workorderId).toBe(500);
      expect(data.contactId).toBe(42);
      expect(data.userId).toBeNull();
      expect(data.watcherType).toBe('Contact');
    });

    test('returns error when adding duplicate watcher', async () => {
      const response = await call(
        'UteamupWorkorderWatcherAdd',
        { workorderId: 500, userId: 'user-abc-123' },
        errorReply(-32000, 'Watcher already exists for this workorder')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Watcher already exists');
    });

    test('returns error when neither userId nor contactId provided', async () => {
      const response = await call(
        'UteamupWorkorderWatcherAdd',
        { workorderId: 500 },
        errorReply(-32602, 'Either userId or contactId must be provided')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32602);
      expect(response.body.error.message).toContain('userId or contactId');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkorderWatcherRemove
  // ---------------------------------------------------------------------------
  describe('UteamupWorkorderWatcherRemove tool', () => {
    test('removes a watcher from a workorder', async () => {
      const response = await call(
        'UteamupWorkorderWatcherRemove',
        { workorderId: 500, watcherId: 1 },
        successReply({ success: true, message: 'Watcher removed' })
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.success).toBe(true);
    });

    test('returns error when watcher not found', async () => {
      const response = await call(
        'UteamupWorkorderWatcherRemove',
        { workorderId: 500, watcherId: 99999 },
        errorReply(-32000, 'Watcher not found')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Watcher not found');
    });

    test('returns error when workorder does not exist', async () => {
      const response = await call(
        'UteamupWorkorderWatcherRemove',
        { workorderId: 99999, watcherId: 1 },
        errorReply(-32000, 'Workorder not found')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Workorder not found');
    });
  });

  // ---------------------------------------------------------------------------
  // Backend error handling
  // ---------------------------------------------------------------------------
  describe('Backend error handling', () => {
    test('handles 500 internal server error gracefully', async () => {
      nock(BASE_URL)
        .post('/mcp', body => body.method === 'tools/call' && body.params?.name === 'UteamupWorkorderWatchlistGet')
        .reply(500, 'Internal Server Error');

      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'UteamupWorkorderWatchlistGet', arguments: { workorderId: 500 } },
        id: 9001
      };

      const response = await new Promise((resolve, reject) => {
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
          res.on('end', () => resolve({ status: res.statusCode, body: responseData }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(response.status).toBe(500);
    });

    test('handles network timeout gracefully', async () => {
      nock(BASE_URL)
        .post('/mcp', body => body.method === 'tools/call' && body.params?.name === 'UteamupWorkorderWatcherAdd')
        .replyWithError('ETIMEDOUT');

      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'UteamupWorkorderWatcherAdd', arguments: { workorderId: 500, userId: 'user-abc-123' } },
        id: 9002
      };

      await expect(new Promise((resolve, reject) => {
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
          res.on('end', () => resolve({ status: res.statusCode, body: responseData }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      })).rejects.toThrow();

      // nock v14's @mswjs/interceptors emits replyWithError via setImmediate.
      // Drain pending immediates so the error doesn't leak into the next test
      // as an unhandled rejection (was flaking JSON-RPC compliance for the
      // first tool in this file's `allTools` array, ~2/3 runs).
      await new Promise(resolve => setImmediate(resolve));
    });
  });

  // ---------------------------------------------------------------------------
  // Shared compliance & auth tests
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupWorkorderWatchlistGet', args: { workorderId: 500 } },
    { name: 'UteamupWorkorderWatcherAdd', args: { workorderId: 500, userId: 'user-abc-123' } },
    { name: 'UteamupWorkorderWatcherRemove', args: { workorderId: 500, watcherId: 1 } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
