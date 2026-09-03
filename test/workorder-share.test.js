/**
 * Proxy contract tests for the live backend WorkorderShareTools schema.
 *
 * Sharing gives one person access to one workorder without tenant membership. The proxy
 * must forward GUID-only arguments, hand back the plaintext share URL exactly once, and
 * never leak integer identifiers or token hashes.
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

describe('Workorder share MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_workorder_share';
  const WORKORDER_GUID = '11111111-1111-4111-8111-111111111111';
  const SHARE_GUID = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    callMcpToolRequest(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const linkShare = {
    guid: SHARE_GUID,
    workorderGuid: WORKORDER_GUID,
    workorderName: 'Replace pump seal',
    isUserShare: false,
    sharedWithEmail: null,
    sharedWithName: null,
    accessLevel: 'readOnly',
    expiresAt: '2026-10-03T12:00:00Z',
    revokedAt: null,
    isActive: true,
    createdByName: 'Demo Admin',
    createdAt: '2026-09-03T12:00:00Z',
    note: null,
    accessCount: 0,
    lastAccessedAt: null
  };

  test('creates an anonymous read-only link and returns the plaintext URL once', async () => {
    const response = await call(
      'UteamupWorkorderShareCreate',
      { workorderGuid: WORKORDER_GUID },
      successReply({
        share: linkShare,
        shareUrl: 'https://app.uteamup.com/public/shared-workorder/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_'
      })
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(response.status).toBe(200);
    expect(data.share.accessLevel).toBe('readOnly');
    expect(data.share.isUserShare).toBe(false);
    expect(data.shareUrl).toMatch(/\/public\/shared-workorder\/[A-Za-z0-9_-]{20,}$/);
    expect(data.share).not.toHaveProperty('tokenHash');
    expect(data.share).not.toHaveProperty('id');
    expect(data.share).not.toHaveProperty('workorderId');
    expect(data.share).not.toHaveProperty('sharedWithUserId');
  });

  test('creates a user-bound edit share by email', async () => {
    const userShare = {
      ...linkShare,
      guid: '33333333-3333-4333-8333-333333333333',
      isUserShare: true,
      sharedWithEmail: 'contractor@example.com',
      sharedWithName: 'Casey Contractor',
      accessLevel: 'edit'
    };
    const response = await call(
      'UteamupWorkorderShareCreate',
      {
        workorderGuid: WORKORDER_GUID,
        email: 'contractor@example.com',
        accessLevel: 'edit',
        expiresInDays: 7,
        note: 'Please close the job when the seal is in.'
      },
      successReply({ share: userShare, shareUrl: 'https://app.uteamup.com/public/shared-workorder/tok' })
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.share.isUserShare).toBe(true);
    expect(data.share.sharedWithEmail).toBe('contractor@example.com');
    expect(data.share.accessLevel).toBe('edit');
  });

  test('surfaces an unknown email as a not-found error', async () => {
    const response = await call(
      'UteamupWorkorderShareCreate',
      { workorderGuid: WORKORDER_GUID, email: 'nobody@example.invalid' },
      errorReply(-32000, 'No UteamUP account exists for nobody@example.invalid')
    );
    expect(response.body.error.message).toContain('No UteamUP account');
  });

  test('lists shares by workorderGuid with GUID-only rows', async () => {
    const revoked = { ...linkShare, guid: '44444444-4444-4444-8444-444444444444', revokedAt: '2026-09-04T09:00:00Z', isActive: false };
    const response = await call(
      'UteamupWorkorderShareList',
      { workorderGuid: WORKORDER_GUID },
      successReply([linkShare, revoked])
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toHaveLength(2);
    expect(data[1].isActive).toBe(false);
    for (const row of data) {
      expect(row).not.toHaveProperty('id');
      expect(row).not.toHaveProperty('tokenHash');
    }
  });

  test('revokes a share by shareGuid only', async () => {
    const response = await call(
      'UteamupWorkorderShareRevoke',
      { shareGuid: SHARE_GUID },
      successReply({ shareGuid: SHARE_GUID, revoked: true })
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toEqual({ shareGuid: SHARE_GUID, revoked: true });
  });

  test('surfaces tenant-scoped lookup failures on revoke', async () => {
    const response = await call(
      'UteamupWorkorderShareRevoke',
      { shareGuid: SHARE_GUID },
      errorReply(-32000, 'Share not found in this tenant, or already revoked')
    );
    expect(response.body.error.message).toContain('not found in this tenant');
  });

  const allTools = [
    { name: 'UteamupWorkorderShareCreate', args: { workorderGuid: WORKORDER_GUID } },
    { name: 'UteamupWorkorderShareList', args: { workorderGuid: WORKORDER_GUID } },
    { name: 'UteamupWorkorderShareRevoke', args: { shareGuid: SHARE_GUID } }
  ];

  test('proxy fixtures carry no integer resource identifiers', () => {
    const serialized = JSON.stringify(allTools);
    expect(serialized).not.toMatch(/workorderId|shareId|userId/);
  });

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
