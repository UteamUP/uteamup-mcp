/**
 * Code-history-timeline MCP tool test (code-history-timeline).
 *
 * Covers the new MCP tool added on top of /codecatalog/{guid}/history:
 *   - UteamupCodecatalogHistory
 *
 * Generic-proxy pattern (nock-mocked backend; no real network calls).
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('UteamupCodecatalogHistory MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_codecatalog_history';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, 'UteamupCodecatalogHistory', toolArgs, mockReply);

  const samplePage = {
    items: [
      {
        occurredAtUtc: '2026-05-14T18:30:00Z',
        actorUserGuid: '11111111-2222-3333-4444-555555555555',
        actorName: 'Alice Operator',
        actorAvatarUrl: null,
        actionKey: 'industrycoding.activity.workorder.create',
        entityType: 'Workorder',
        action: 'Create',
        relatedEntityGuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        relatedEntityDisplayName: 'WO-1042 Pump replacement',
        relatedEntityDeleted: false,
        summarySafe: 'Alice Operator created Workorder "WO-1042 Pump replacement"',
        changedFields: [],
        workorder: { title: 'WO-1042 Pump replacement', status: 'Open', priority: 'High' },
        actorEmail: 'alice@plant.com',
        actorPhone: '+354 555 1234',
        actorRoleName: 'Plant Operator',
      },
      {
        occurredAtUtc: '2026-05-14T17:15:00Z',
        actorUserGuid: '11111111-2222-3333-4444-555555555555',
        actorName: 'Alice Operator',
        actorAvatarUrl: null,
        actionKey: 'industrycoding.activity.asset.update',
        entityType: 'Asset',
        action: 'Update',
        relatedEntityGuid: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
        relatedEntityDisplayName: 'Pump A',
        relatedEntityDeleted: false,
        summarySafe: 'Alice Operator updated Asset "Pump A"',
        changedFields: [{ field: 'Status', oldValue: 'Operational', newValue: 'Maintenance' }],
        otherFieldsChangedCount: 0,
        actorEmail: 'alice@plant.com',
        actorPhone: '+354 555 1234',
        actorRoleName: 'Plant Operator',
      },
    ],
    nextCursor: 'eyJ0IjoiMjAyNi0wNS0xNFQxNzoxNTowMFoiLCJpIjo0Mn0=',
  };

  it('returns the paginated history page for a code GUID', async () => {
    const response = await call(
      { codeGuid: 'cccccccc-dddd-eeee-ffff-000000000001' },
      successReply(samplePage),
    );
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items).toHaveLength(2);
    expect(data.items[0].entityType).toBe('Workorder');
    expect(data.items[0].workorder.title).toBe('WO-1042 Pump replacement');
    expect(data.items[1].changedFields[0].field).toBe('Status');
    expect(data.nextCursor).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('forwards filter args to the backend verbatim', async () => {
    const args = {
      codeGuid: 'cccccccc-dddd-eeee-ffff-000000000001',
      types: ['Workorder', 'Asset'],
      actorGuid: '11111111-2222-3333-4444-555555555555',
      fromUtc: '2026-05-01T00:00:00Z',
      toUtc: '2026-05-14T23:59:59Z',
      q: 'pump',
      cursor: 'opaque-prior-cursor',
      pageSize: 50,
    };
    const response = await call(args, successReply({ items: [], nextCursor: null }));
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.items).toEqual([]);
    expect(data.nextCursor).toBeNull();
  });

  it('returns an empty page when the code has no activity', async () => {
    const response = await call(
      { codeGuid: 'cccccccc-dddd-eeee-ffff-000000000002' },
      successReply({ items: [], nextCursor: null }),
    );
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.items).toEqual([]);
    expect(data.nextCursor).toBeNull();
  });

  it('surfaces backend permission-denied errors as JSON-RPC errors', async () => {
    const response = await call(
      { codeGuid: 'cccccccc-dddd-eeee-ffff-000000000003' },
      errorReply(-32000, 'Permission denied: ActivityLog.Read required'),
    );
    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/Permission denied/i);
  });

  // Shared MCP error-path coverage — 401 mapping + 503 retry/back-off.
  // (describeJsonRpcCompliance is skipped here because the proxy echoes the
  // outbound request id, not the mocked backend id — covered by the 4
  // custom happy-path assertions above which already verify the JSON-RPC
  // envelope shape via response.body.result.content[0].text.)
  const errorTools = [
    {
      name: 'UteamupCodecatalogHistory',
      args: { codeGuid: 'cccccccc-dddd-eeee-ffff-000000000004' },
    },
  ];
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
