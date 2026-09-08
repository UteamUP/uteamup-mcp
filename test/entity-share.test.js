/**
 * Proxy contract tests for the live backend EntityShareTools schema.
 *
 * Sharing gives one person access to one asset or asset group without tenant membership. Three
 * things are load-bearing for the proxy: `entityType` decides which permission pair the backend
 * requires and must never be dropped or defaulted; the per-section grid must be forwarded verbatim
 * because omitting it silently falls back to the default grid; and the plaintext share URL is
 * returned exactly once — no token hash, and no integer identifiers, on the way back.
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

describe('Entity share MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_entity_share';
  const ASSET_GUID = '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a';
  const GROUP_GUID = '2b2b2b2b-2b2b-42b2-82b2-2b2b2b2b2b2b';
  const SHARE_GUID = '3c3c3c3c-3c3c-43c3-83c3-3c3c3c3c3c3c';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    callMcpToolRequest(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  // The default grid the backend builds for an asset when `sections` is omitted: the six
  // descriptive sections, with meters, workorders, journals, failures, criticality and activity
  // withheld.
  const assetDefaultGrid = [
    { sectionKey: 'details', accessLevel: 'read' },
    { sectionKey: 'specifications', accessLevel: 'read' },
    { sectionKey: 'documents', accessLevel: 'read' },
    { sectionKey: 'parts', accessLevel: 'read' },
    { sectionKey: 'hierarchy', accessLevel: 'read' },
    { sectionKey: 'dependencies', accessLevel: 'read' },
    { sectionKey: 'meters', accessLevel: 'none' },
    { sectionKey: 'workorders', accessLevel: 'none' },
    { sectionKey: 'journals', accessLevel: 'none' },
    { sectionKey: 'failures', accessLevel: 'none' },
    { sectionKey: 'criticality', accessLevel: 'none' },
    { sectionKey: 'activity', accessLevel: 'none' }
  ];

  // The group grid: overview, members, diagram, dependencies and impact on; insights, history and
  // live status withheld.
  const groupDefaultGrid = [
    { sectionKey: 'overview', accessLevel: 'read' },
    { sectionKey: 'members', accessLevel: 'read' },
    { sectionKey: 'diagram', accessLevel: 'read' },
    { sectionKey: 'dependencies', accessLevel: 'read' },
    { sectionKey: 'impact', accessLevel: 'read' },
    { sectionKey: 'insights', accessLevel: 'none' },
    { sectionKey: 'history', accessLevel: 'none' },
    { sectionKey: 'livestatus', accessLevel: 'none' }
  ];

  const assetLinkShare = {
    guid: SHARE_GUID,
    entityType: 'asset',
    targetGuid: ASSET_GUID,
    targetName: 'Feed pump 1',
    sharedWithEmail: null,
    audience: 'anonymousLink',
    accessLevel: 'read',
    expiresAt: '2026-10-08T12:00:00Z',
    revokedAt: null,
    note: null,
    accessCount: 0,
    lastAccessedAt: null,
    isActive: true,
    sections: assetDefaultGrid,
    createdAt: '2026-09-08T12:00:00Z'
  };

  test('creates an anonymous asset link and returns the plaintext URL once', async () => {
    const response = await call(
      'UteamupShareCreate',
      { entityType: 'Asset', model: { targetGuid: ASSET_GUID } },
      successReply({
        share: assetLinkShare,
        shareUrl: 'https://app.uteamup.com/public/shared-asset/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_'
      }),
      { entityType: 'Asset', model: { targetGuid: ASSET_GUID } }
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.share.audience).toBe('anonymousLink');
    expect(data.shareUrl).toMatch(/\/public\/shared-asset\/[A-Za-z0-9_-]{20,}$/);
    expect(data.share).not.toHaveProperty('tokenHash');
    expect(data.share).not.toHaveProperty('id');
    expect(data.share).not.toHaveProperty('targetId');
    expect(data.share).not.toHaveProperty('sharedWithUserId');
  });

  test('the default asset grid withholds meters, workorders, journals, failures and activity', async () => {
    const response = await call(
      'UteamupShareCreate',
      { entityType: 'Asset', model: { targetGuid: ASSET_GUID } },
      successReply({ share: assetLinkShare, shareUrl: 'https://app.uteamup.com/public/shared-asset/tok' })
    );
    const data = JSON.parse(response.body.result.content[0].text);
    const level = (key) => data.share.sections.find((row) => row.sectionKey === key).accessLevel;

    expect(level('details')).toBe('read');
    expect(level('meters')).toBe('none');
    expect(level('workorders')).toBe('none');
    expect(level('journals')).toBe('none');
    expect(level('criticality')).toBe('none');
    expect(data.share.sections).toHaveLength(12);
  });

  test('the default group grid withholds insights, history and live status', async () => {
    const response = await call(
      'UteamupShareCreate',
      { entityType: 'AssetGroup', model: { targetGuid: GROUP_GUID } },
      successReply({
        share: { ...assetLinkShare, entityType: 'assetGroup', targetGuid: GROUP_GUID, targetName: 'Boiler House', sections: groupDefaultGrid },
        shareUrl: 'https://app.uteamup.com/public/shared-asset-group/tok'
      }),
      { entityType: 'AssetGroup', model: { targetGuid: GROUP_GUID } }
    );
    const data = JSON.parse(response.body.result.content[0].text);
    const level = (key) => data.share.sections.find((row) => row.sectionKey === key).accessLevel;

    expect(data.share.entityType).toBe('assetGroup');
    expect(level('diagram')).toBe('read');
    expect(level('insights')).toBe('none');
    expect(level('livestatus')).toBe('none');
    expect(data.share.sections).toHaveLength(8);
  });

  test('forwards a scoped grid and the ceiling verbatim', async () => {
    const model = {
      targetGuid: GROUP_GUID,
      accessLevel: 'Write',
      expiresInDays: 7,
      sections: [
        { sectionKey: 'diagram', accessLevel: 'Update' },
        { sectionKey: 'dependencies', accessLevel: 'Write' },
        { sectionKey: 'members', accessLevel: 'Read' }
      ]
    };
    const response = await call(
      'UteamupShareCreate',
      { entityType: 'AssetGroup', model },
      successReply({
        share: {
          ...assetLinkShare,
          entityType: 'assetGroup',
          targetGuid: GROUP_GUID,
          accessLevel: 'write',
          sections: groupDefaultGrid.map((row) =>
            row.sectionKey === 'diagram' ? { ...row, accessLevel: 'update' }
              : row.sectionKey === 'dependencies' ? { ...row, accessLevel: 'write' }
                : row)
        },
        shareUrl: 'https://app.uteamup.com/public/shared-asset-group/tok'
      }),
      { entityType: 'AssetGroup', model }
    );
    const data = JSON.parse(response.body.result.content[0].text);
    const level = (key) => data.share.sections.find((row) => row.sectionKey === key).accessLevel;

    expect(data.share.accessLevel).toBe('write');
    expect(level('diagram')).toBe('update');
    expect(level('dependencies')).toBe('write');
  });

  test('creates a user-bound share by email and reports the audience', async () => {
    const response = await call(
      'UteamupShareCreate',
      { entityType: 'Asset', model: { targetGuid: ASSET_GUID, email: 'inspector@example.com', note: 'Annual inspection' } },
      successReply({
        share: { ...assetLinkShare, sharedWithEmail: 'inspector@example.com', audience: 'external', note: 'Annual inspection' },
        shareUrl: 'https://app.uteamup.com/public/shared-asset/tok'
      })
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.share.sharedWithEmail).toBe('inspector@example.com');
    expect(data.share.audience).toBe('external');
  });

  test('surfaces an unknown email as a not-found error', async () => {
    const response = await call(
      'UteamupShareCreate',
      { entityType: 'Asset', model: { targetGuid: ASSET_GUID, email: 'nobody@example.invalid' } },
      errorReply(-32000, 'No UteamUP account exists for that email.')
    );
    expect(response.body.error.message).toContain('No UteamUP account');
  });

  test('surfaces a view-only asset section set above read as a validation error naming it', async () => {
    const response = await call(
      'UteamupShareCreate',
      { entityType: 'Asset', model: { targetGuid: ASSET_GUID, accessLevel: 'Write', sections: [{ sectionKey: 'documents', accessLevel: 'Write' }] } },
      errorReply(-32000, "Section 'documents' is view-only and cannot be set to Write.")
    );
    expect(response.body.error.message).toContain('documents');
    expect(response.body.error.message).toContain('view-only');
  });

  test('surfaces a section above the ceiling as a validation error', async () => {
    const response = await call(
      'UteamupShareCreate',
      { entityType: 'AssetGroup', model: { targetGuid: GROUP_GUID, accessLevel: 'Read', sections: [{ sectionKey: 'dependencies', accessLevel: 'Write' }] } },
      errorReply(-32000, "Section 'dependencies' is set to Write, above the share's Read ceiling.")
    );
    expect(response.body.error.message).toContain('ceiling');
  });

  test('lists shares by entityType and targetGuid, including revoked rows', async () => {
    const revoked = { ...assetLinkShare, guid: '4d4d4d4d-4d4d-44d4-84d4-4d4d4d4d4d4d', revokedAt: '2026-09-07T09:00:00Z', isActive: false };
    const response = await call(
      'UteamupShareListByTarget',
      { entityType: 'Asset', targetGuid: ASSET_GUID },
      successReply([assetLinkShare, revoked]),
      { entityType: 'Asset', targetGuid: ASSET_GUID }
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data).toHaveLength(2);
    expect(data[1].isActive).toBe(false);
    for (const row of data) {
      expect(row).not.toHaveProperty('tokenHash');
      expect(row).not.toHaveProperty('id');
      expect(row.sections).toHaveLength(12);
    }
  });

  test('update carries the entityType so the backend can pick the permission pair', async () => {
    const model = { accessLevel: 'Update', expiresInDays: 30, sections: [{ sectionKey: 'diagram', accessLevel: 'Update' }] };
    const response = await call(
      'UteamupShareUpdate',
      { entityType: 'AssetGroup', shareGuid: SHARE_GUID, model },
      successReply({ ...assetLinkShare, entityType: 'assetGroup', targetGuid: GROUP_GUID, accessLevel: 'update', sections: groupDefaultGrid }),
      { entityType: 'AssetGroup', shareGuid: SHARE_GUID, model }
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.accessLevel).toBe('update');
    expect(data.entityType).toBe('assetGroup');
  });

  test('an entityType that does not match the stored share is refused', async () => {
    const response = await call(
      'UteamupShareUpdate',
      { entityType: 'Asset', shareGuid: SHARE_GUID, model: { accessLevel: 'Read' } },
      errorReply(-32000, 'Share not found in this tenant')
    );
    expect(response.body.error.message).toContain('not found in this tenant');
  });

  test('revokes a share by entityType and share GUID only', async () => {
    const response = await call(
      'UteamupShareRevoke',
      { entityType: 'Asset', shareGuid: SHARE_GUID },
      successReply({ shareGuid: SHARE_GUID, revoked: true }),
      { entityType: 'Asset', shareGuid: SHARE_GUID }
    );
    expect(JSON.parse(response.body.result.content[0].text))
      .toEqual({ shareGuid: SHARE_GUID, revoked: true });
  });

  test('revoking an already revoked share reports revoked:false rather than failing', async () => {
    const response = await call(
      'UteamupShareRevoke',
      { entityType: 'Asset', shareGuid: SHARE_GUID },
      successReply({ shareGuid: SHARE_GUID, revoked: false })
    );
    expect(JSON.parse(response.body.result.content[0].text).revoked).toBe(false);
  });

  test('shared-with-me spans tenants and never returns a token', async () => {
    const response = await call(
      'UteamupShareSharedWithMe',
      {},
      successReply([
        {
          guid: SHARE_GUID,
          entityType: 'asset',
          targetGuid: ASSET_GUID,
          targetName: 'Feed pump 1',
          tenantName: 'Solid Energy',
          sharedByName: 'Demo Admin',
          audience: 'external',
          accessLevel: 'read',
          expiresAt: '2026-10-08T12:00:00Z',
          createdAt: '2026-09-08T12:00:00Z',
          note: null
        }
      ])
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data[0].tenantName).toBe('Solid Energy');
    expect(data[0]).not.toHaveProperty('token');
    expect(data[0]).not.toHaveProperty('shareUrl');
    expect(data[0]).not.toHaveProperty('tokenHash');
  });

  test('shared-with-me forwards the optional entityType filter verbatim', async () => {
    const response = await call(
      'UteamupShareSharedWithMe',
      { entityType: 'AssetGroup' },
      successReply([]),
      { entityType: 'AssetGroup' }
    );
    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });

  const allTools = [
    { name: 'UteamupShareCreate', args: { entityType: 'Asset', model: { targetGuid: ASSET_GUID } } },
    { name: 'UteamupShareListByTarget', args: { entityType: 'Asset', targetGuid: ASSET_GUID } },
    { name: 'UteamupShareUpdate', args: { entityType: 'Asset', shareGuid: SHARE_GUID, model: { accessLevel: 'Read' } } },
    { name: 'UteamupShareRevoke', args: { entityType: 'Asset', shareGuid: SHARE_GUID } },
    { name: 'UteamupShareSharedWithMe', args: {} }
  ];

  test('the tool matrix covers every entity share tool exactly once', () => {
    expect(allTools).toHaveLength(5);
    expect(new Set(allTools.map((tool) => tool.name)).size).toBe(allTools.length);
  });

  test('every management tool carries an explicit entityType', () => {
    for (const tool of allTools.filter((candidate) => candidate.name !== 'UteamupShareSharedWithMe')) {
      expect(tool.args.entityType).toBeDefined();
    }
  });

  test('proxy fixtures carry no integer resource identifiers', () => {
    const serialized = JSON.stringify(allTools);
    expect(serialized).not.toMatch(/"(shareId|targetId|assetId|groupId|tenantId|userId)"/);
  });

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
