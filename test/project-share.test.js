/**
 * Proxy contract tests for the live backend ProjectShareTools schema.
 *
 * Sharing gives one person access to one project without tenant membership. Unlike a
 * workorder share it carries a per-section scope grid and a workorder sub-level, so the
 * proxy must forward those faithfully — a dropped `sections` argument silently widens the
 * grant to the default. As everywhere, GUID-only arguments, the plaintext share URL exactly
 * once, and no integer identifiers or token hashes on the way back.
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

describe('Project share MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_project_share';
  const PROJECT_GUID = '55555555-5555-4555-8555-555555555555';
  const SHARE_GUID = '66666666-6666-4666-8666-666666666666';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    callMcpToolRequest(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // The default grid the backend builds when `sections` is omitted: everything at the
  // ceiling except budget, bom and team, which start withheld.
  const defaultGrid = [
    { section: 'overview', accessLevel: 'read' },
    { section: 'health', accessLevel: 'read' },
    { section: 'stages', accessLevel: 'read' },
    { section: 'deliverables', accessLevel: 'read' },
    { section: 'risks', accessLevel: 'read' },
    { section: 'budget', accessLevel: 'none' },
    { section: 'bom', accessLevel: 'none' },
    { section: 'kanban', accessLevel: 'read' },
    { section: 'workorders', accessLevel: 'read' },
    { section: 'team', accessLevel: 'none' },
    { section: 'dependencies', accessLevel: 'read' },
    { section: 'activity', accessLevel: 'read' },
    { section: 'baselines', accessLevel: 'read' }
  ];

  const linkShare = {
    guid: SHARE_GUID,
    projectGuid: PROJECT_GUID,
    projectName: 'Turnaround 2026',
    isUserShare: false,
    sharedWithEmail: null,
    sharedWithName: null,
    audience: 'anonymousLink',
    accessLevel: 'read',
    workorderAccessLevel: 'none',
    sections: defaultGrid,
    expiresAt: '2026-10-04T12:00:00Z',
    revokedAt: null,
    isActive: true,
    createdByName: 'Demo Admin',
    createdAt: '2026-09-04T12:00:00Z',
    note: null,
    accessCount: 0,
    lastAccessedAt: null
  };

  test('creates an anonymous read-only link and returns the plaintext URL once', async () => {
    const response = await call(
      'UteamupProjectShareCreate',
      { projectGuid: PROJECT_GUID },
      successReply({
        share: linkShare,
        shareUrl: 'https://app.uteamup.com/public/shared-project/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_'
      })
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(response.status).toBe(200);
    expect(data.share.accessLevel).toBe('read');
    expect(data.share.audience).toBe('anonymousLink');
    expect(data.share.isUserShare).toBe(false);
    expect(data.shareUrl).toMatch(/\/public\/shared-project\/[A-Za-z0-9_-]{20,}$/);
    expect(data.share).not.toHaveProperty('tokenHash');
    expect(data.share).not.toHaveProperty('id');
    expect(data.share).not.toHaveProperty('projectId');
    expect(data.share).not.toHaveProperty('sharedWithUserId');
  });

  test('the default grid withholds money and people', async () => {
    const response = await call(
      'UteamupProjectShareCreate',
      { projectGuid: PROJECT_GUID },
      successReply({ share: linkShare, shareUrl: 'https://app.uteamup.com/public/shared-project/tok' })
    );
    const data = JSON.parse(response.body.result.content[0].text);
    const level = (name) => data.share.sections.find((s) => s.section === name).accessLevel;

    expect(level('budget')).toBe('none');
    expect(level('bom')).toBe('none');
    expect(level('team')).toBe('none');
    expect(level('overview')).toBe('read');
    expect(level('stages')).toBe('read');
    expect(data.share.sections).toHaveLength(13);
  });

  test('forwards a scoped grid and the workorder sub-level', async () => {
    const scoped = {
      ...linkShare,
      guid: '77777777-7777-4777-8777-777777777777',
      accessLevel: 'update',
      workorderAccessLevel: 'update',
      sections: defaultGrid.map((s) =>
        s.section === 'stages' ? { ...s, accessLevel: 'update' }
          : s.section === 'workorders' ? { ...s, accessLevel: 'update' }
            : s
      )
    };
    const response = await call(
      'UteamupProjectShareCreate',
      {
        projectGuid: PROJECT_GUID,
        accessLevel: 'update',
        workorderAccessLevel: 'update',
        sections: ['stages=update', 'workorders=update', 'budget=none'],
        expiresInDays: 7
      },
      successReply({ share: scoped, shareUrl: 'https://app.uteamup.com/public/shared-project/tok' })
    );
    const data = JSON.parse(response.body.result.content[0].text);
    const level = (name) => data.share.sections.find((s) => s.section === name).accessLevel;

    expect(data.share.accessLevel).toBe('update');
    expect(level('stages')).toBe('update');
    expect(data.share.workorderAccessLevel).toBe('update');
  });

  test('creates a user-bound share by email and reports the audience', async () => {
    const userShare = {
      ...linkShare,
      guid: '88888888-8888-4888-8888-888888888888',
      isUserShare: true,
      sharedWithEmail: 'contractor@example.com',
      sharedWithName: 'Casey Contractor',
      audience: 'external'
    };
    const response = await call(
      'UteamupProjectShareCreate',
      {
        projectGuid: PROJECT_GUID,
        email: 'contractor@example.com',
        note: 'Stage plan only, please.'
      },
      successReply({ share: userShare, shareUrl: 'https://app.uteamup.com/public/shared-project/tok' })
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.share.isUserShare).toBe(true);
    expect(data.share.sharedWithEmail).toBe('contractor@example.com');
    expect(data.share.audience).toBe('external');
  });

  test('reports an internal audience for a tenant member', async () => {
    const internal = { ...linkShare, isUserShare: true, sharedWithEmail: 'colleague@uteamup.com', audience: 'internal' };
    const response = await call(
      'UteamupProjectShareCreate',
      { projectGuid: PROJECT_GUID, email: 'colleague@uteamup.com' },
      successReply({ share: internal, shareUrl: 'https://app.uteamup.com/public/shared-project/tok' })
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.share.audience).toBe('internal');
  });

  test('surfaces an unknown email as a not-found error', async () => {
    const response = await call(
      'UteamupProjectShareCreate',
      { projectGuid: PROJECT_GUID, email: 'nobody@example.invalid' },
      errorReply(-32000, 'No UteamUP account exists for that email.')
    );
    expect(response.body.error.message).toContain('No UteamUP account');
  });

  test('surfaces a section above the ceiling as a validation error naming the section', async () => {
    const response = await call(
      'UteamupProjectShareCreate',
      { projectGuid: PROJECT_GUID, accessLevel: 'update', sections: ['stages=write'] },
      errorReply(-32000, "Section 'Stages' is set to Write, above the share's Update ceiling.")
    );
    expect(response.body.error.message).toContain('Stages');
    expect(response.body.error.message).toContain('ceiling');
  });

  test('surfaces a view-only section set above read as a validation error', async () => {
    const response = await call(
      'UteamupProjectShareCreate',
      { projectGuid: PROJECT_GUID, accessLevel: 'write', sections: ['budget=write'] },
      errorReply(-32000, "Section 'Budget' is view-only and cannot be set to Write.")
    );
    expect(response.body.error.message).toContain('Budget');
    expect(response.body.error.message).toContain('view-only');
  });

  test('lists shares by projectGuid with GUID-only rows', async () => {
    const revoked = { ...linkShare, guid: '99999999-9999-4999-8999-999999999999', revokedAt: '2026-09-05T09:00:00Z', isActive: false };
    const response = await call(
      'UteamupProjectShareList',
      { projectGuid: PROJECT_GUID },
      successReply([linkShare, revoked])
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toHaveLength(2);
    expect(data[1].isActive).toBe(false);
    for (const row of data) {
      expect(row).not.toHaveProperty('id');
      expect(row).not.toHaveProperty('tokenHash');
      expect(row.sections).toHaveLength(13);
    }
  });

  test('revokes a share by shareGuid only', async () => {
    const response = await call(
      'UteamupProjectShareRevoke',
      { shareGuid: SHARE_GUID },
      successReply({ shareGuid: SHARE_GUID, revoked: true })
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toEqual({ shareGuid: SHARE_GUID, revoked: true });
  });

  test('surfaces tenant-scoped lookup failures on revoke', async () => {
    const response = await call(
      'UteamupProjectShareRevoke',
      { shareGuid: SHARE_GUID },
      errorReply(-32000, 'Share not found in this tenant, or already revoked')
    );
    expect(response.body.error.message).toContain('not found in this tenant');
  });

  const allTools = [
    { name: 'UteamupProjectShareCreate', args: { projectGuid: PROJECT_GUID } },
    { name: 'UteamupProjectShareList', args: { projectGuid: PROJECT_GUID } },
    { name: 'UteamupProjectShareRevoke', args: { shareGuid: SHARE_GUID } }
  ];

  test('proxy fixtures carry no integer resource identifiers', () => {
    const serialized = JSON.stringify(allTools);
    expect(serialized).not.toMatch(/projectId|shareId|userId/);
  });

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
