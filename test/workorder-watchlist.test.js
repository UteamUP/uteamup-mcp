/**
 * Proxy contract tests for the live backend WorkorderWatchlistTools schema.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: callMcpToolRequest,
  successReply,
  errorReply
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
} = require('./helpers/mcp-error-tests');

describe('Workorder watchlist MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_watchlist';
  const WORKORDER_GUID = '11111111-1111-4111-8111-111111111111';
  const WATCHER_GUID = '22222222-2222-4222-8222-222222222222';
  const CONTACT_GUID = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    callMcpToolRequest(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const userWatcher = {
    externalGuid: WATCHER_GUID,
    workorderGuid: WORKORDER_GUID,
    userId: 'user-abc-123',
    contactGuid: null,
    userFullName: 'John Doe',
    userEmail: 'john.doe@example.com',
    notifyOnStatusChange: true,
    notifyOnComment: true,
    notifyOnAssignment: true,
    notifyOnAll: true,
    createdAt: '2026-03-10T08:00:00Z',
    updatedAt: '2026-03-10T08:00:00Z'
  };

  test('lists GUID-only watcher responses', async () => {
    const response = await call(
      'UteamupWorkorderWatchlistGet',
      { workorderGuid: WORKORDER_GUID },
      successReply([userWatcher])
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(response.status).toBe(200);
    expect(data).toEqual([userWatcher]);
    expect(data[0]).not.toHaveProperty('id');
    expect(data[0]).not.toHaveProperty('workorderId');
    expect(data[0]).not.toHaveProperty('contactId');
  });

  test('adds a user watcher with workorderGuid', async () => {
    const response = await call(
      'UteamupWorkorderWatcherAdd',
      { workorderGuid: WORKORDER_GUID, userId: 'user-abc-123' },
      successReply(userWatcher)
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.externalGuid).toBe(WATCHER_GUID);
    expect(data.workorderGuid).toBe(WORKORDER_GUID);
    expect(data.userId).toBe('user-abc-123');
  });

  test('adds a contact watcher with contactGuid', async () => {
    const contactWatcher = {
      ...userWatcher,
      externalGuid: '44444444-4444-4444-8444-444444444444',
      userId: null,
      userFullName: null,
      userEmail: null,
      contactGuid: CONTACT_GUID,
      contactFullName: 'Jane Smith',
      contactEmail: 'jane.smith@example.com'
    };
    const response = await call(
      'UteamupWorkorderWatcherAdd',
      { workorderGuid: WORKORDER_GUID, contactGuid: CONTACT_GUID },
      successReply(contactWatcher)
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.contactGuid).toBe(CONTACT_GUID);
    expect(data).not.toHaveProperty('contactId');
  });

  test('removes a watcher with watcherGuid only', async () => {
    const response = await call(
      'UteamupWorkorderWatcherRemove',
      { watcherGuid: WATCHER_GUID },
      successReply(true)
    );

    expect(JSON.parse(response.body.result.content[0].text)).toBe(true);
  });

  test('surfaces tenant-scoped lookup failures', async () => {
    const response = await call(
      'UteamupWorkorderWatchlistGet',
      { workorderGuid: WORKORDER_GUID },
      errorReply(-32000, 'Workorder was not found in the tenant')
    );

    expect(response.body.error.message).toContain('not found in the tenant');
  });

  const allTools = [
    { name: 'UteamupWorkorderWatchlistGet', args: { workorderGuid: WORKORDER_GUID } },
    {
      name: 'UteamupWorkorderWatcherAdd',
      args: { workorderGuid: WORKORDER_GUID, contactGuid: CONTACT_GUID }
    },
    { name: 'UteamupWorkorderWatcherRemove', args: { watcherGuid: WATCHER_GUID } }
  ];

  test('proxy fixtures carry no integer resource identifiers', () => {
    const serialized = JSON.stringify(allTools);
    expect(serialized).not.toMatch(/workorderId|contactId|watcherId/);
  });

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
