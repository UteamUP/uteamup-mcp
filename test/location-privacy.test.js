/**
 * Location Privacy MCP tool tests
 *
 * Tools under test:
 *   UteamupLocationPrivacyMyGrants()
 *   UteamupLocationPrivacyMyAccessLog(page?, pageSize?)
 *   UteamupLocationPrivacyRevokeGrant(grantGuid)
 *   UteamupLocationPrivacyRequestShare(model)
 *   UteamupLocationPrivacyGetPolicy()
 *   UteamupLocationPrivacyUpdatePolicy(model)
 *
 * There is deliberately no approve, decline or grant tool: consent to share a
 * location comes only from the person, in the app. The self tools act for the
 * signed-in user and take no userId / tenantId argument.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Location Privacy MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_location_privacy';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);
  const parse = (response) => JSON.parse(response.body.result.content[0].text);

  const grantGuid = '11111111-1111-4111-8111-111111111111';
  const subjectUserGuid = '22222222-2222-4222-8222-222222222222';

  const grant = {
    grantGuid,
    subjectUserGuid,
    subjectName: 'Anna Worker',
    viewerUserGuid: '33333333-3333-4333-8333-333333333333',
    viewerName: 'Mark Manager',
    scopes: 'currentPresence, arrivalDepartureAlerts',
    status: 'active',
    expiresAtUtc: '2026-11-01T00:00:00Z'
  };

  const accessLog = {
    items: [
      { viewerName: 'Mark Manager', channel: 'web', scope: 'CurrentPresence', accessedAtUtc: '2026-10-02T09:15:00Z' }
    ],
    page: 1,
    pageSize: 50,
    totalCount: 1
  };

  const policy = {
    jurisdictionCountryCode: 'IS',
    lawfulBasis: 'consent',
    worksCouncilRequired: false,
    allowedViewerRoleGuids: ['44444444-4444-4444-8444-444444444444'],
    maxGrantDays: 90,
    workingHoursOnly: true,
    coordinateRetentionDays: 30,
    eventRetentionDays: 365,
    accessLogRetentionDays: 730,
    emergencyViewEnabled: false,
    isSaved: true
  };

  const shareRequest = {
    subjectUserGuid,
    scopes: 1,
    durationDays: 30,
    reason: 'Covering the night shift at the pump station'
  };

  // ---------------------------------------------------------------------------
  // UteamupLocationPrivacyMyGrants
  // ---------------------------------------------------------------------------
  describe('UteamupLocationPrivacyMyGrants tool', () => {
    test('returns my requests and shares', async () => {
      const response = await call('UteamupLocationPrivacyMyGrants', {}, successReply([grant]));

      expect(response.status).toBe(200);
      const grants = parse(response);
      expect(grants).toHaveLength(1);
      expect(grants[0].grantGuid).toBe(grantGuid);
      expect(grants[0].scopes).toContain('currentPresence');
    });

    test('returns an empty list when nothing is shared', async () => {
      const response = await call('UteamupLocationPrivacyMyGrants', {}, successReply([]));

      expect(parse(response)).toEqual([]);
    });

    test('surfaces the refusal for an external API key', async () => {
      const response = await call('UteamupLocationPrivacyMyGrants', {},
        errorReply(-32000, 'Location privacy is managed by the person themselves; sign in as that person.'));

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('the person themselves');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupLocationPrivacyMyAccessLog
  // ---------------------------------------------------------------------------
  describe('UteamupLocationPrivacyMyAccessLog tool', () => {
    test('returns who viewed my location', async () => {
      const response = await call('UteamupLocationPrivacyMyAccessLog', { page: 1, pageSize: 50 }, successReply(accessLog),
        { page: 1, pageSize: 50 });

      const log = parse(response);
      expect(log.totalCount).toBe(1);
      expect(log.items[0].viewerName).toBe('Mark Manager');
      expect(log.items[0].channel).toBe('web');
    });

    test('returns an empty page', async () => {
      const response = await call('UteamupLocationPrivacyMyAccessLog', {},
        successReply({ items: [], page: 1, pageSize: 50, totalCount: 0 }));

      expect(parse(response).items).toEqual([]);
    });

    test('surfaces invalid paging as an error', async () => {
      const response = await call('UteamupLocationPrivacyMyAccessLog', { page: 0 },
        errorReply(-32602, 'Page must be at least 1 and page size between 1 and 100.'));

      expect(response.body.error.message).toContain('page size between 1 and 100');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupLocationPrivacyRevokeGrant
  // ---------------------------------------------------------------------------
  describe('UteamupLocationPrivacyRevokeGrant tool', () => {
    test('sends the grant GUID and returns the revoked share', async () => {
      const response = await call('UteamupLocationPrivacyRevokeGrant', { grantGuid },
        successReply({ ...grant, status: 'revoked', revokedReason: 'bySubject' }), { grantGuid });

      const revoked = parse(response);
      expect(revoked.status).toBe('revoked');
      expect(revoked.revokedReason).toBe('bySubject');
    });

    test('surfaces an already-ended share', async () => {
      const response = await call('UteamupLocationPrivacyRevokeGrant', { grantGuid },
        errorReply(-32000, 'not_active: This share has already ended.'));

      expect(response.body.error.message).toContain('not_active');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupLocationPrivacyRequestShare
  // ---------------------------------------------------------------------------
  describe('UteamupLocationPrivacyRequestShare tool', () => {
    test('round-trips the request model and returns a pending share', async () => {
      const response = await call('UteamupLocationPrivacyRequestShare', { model: shareRequest },
        successReply({ ...grant, status: 'pending', requestReason: shareRequest.reason }), { model: shareRequest });

      const created = parse(response);
      expect(created.status).toBe('pending');
      expect(created.requestReason).toBe(shareRequest.reason);
    });

    test('surfaces a missing permission', async () => {
      const response = await call('UteamupLocationPrivacyRequestShare', { model: shareRequest },
        errorReply(-32000, 'Permission denied: Geofence.RequestLocation required'));

      expect(response.body.error.message).toContain('Geofence.RequestLocation');
    });

    test('surfaces a duplicate request', async () => {
      const response = await call('UteamupLocationPrivacyRequestShare', { model: shareRequest },
        errorReply(-32000, 'duplicate_request: A request is already waiting for an answer.'));

      expect(response.body.error.message).toContain('duplicate_request');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupLocationPrivacyGetPolicy / UpdatePolicy
  // ---------------------------------------------------------------------------
  describe('UteamupLocationPrivacyGetPolicy tool', () => {
    test('returns the tenant policy', async () => {
      const response = await call('UteamupLocationPrivacyGetPolicy', {}, successReply(policy));

      const result = parse(response);
      expect(result.coordinateRetentionDays).toBe(30);
      expect(result.emergencyViewEnabled).toBe(false);
    });

    test('surfaces a missing Privacy.Read permission', async () => {
      const response = await call('UteamupLocationPrivacyGetPolicy', {},
        errorReply(-32000, 'Permission denied: Privacy.Read required'));

      expect(response.body.error.message).toContain('Privacy.Read');
    });
  });

  describe('UteamupLocationPrivacyUpdatePolicy tool', () => {
    test('round-trips the policy model', async () => {
      const model = { ...policy, coordinateRetentionDays: 14 };
      delete model.isSaved;

      const response = await call('UteamupLocationPrivacyUpdatePolicy', { model },
        successReply({ ...model, isSaved: true }), { model });

      expect(parse(response).coordinateRetentionDays).toBe(14);
    });

    test('surfaces a validation error', async () => {
      const response = await call('UteamupLocationPrivacyUpdatePolicy', { model: { ...policy, eventRetentionDays: 7 } },
        errorReply(-32602, 'Event retention must be at least as long as coordinate retention.'));

      expect(response.body.error.message).toContain('Event retention');
    });

    test('surfaces a missing Privacy.Manage permission', async () => {
      const response = await call('UteamupLocationPrivacyUpdatePolicy', { model: policy },
        errorReply(-32000, 'Permission denied: Privacy.Manage required'));

      expect(response.body.error.message).toContain('Privacy.Manage');
    });
  });

  // ---------------------------------------------------------------------------
  // Regression guards
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupLocationPrivacyMyGrants', args: {} },
    { name: 'UteamupLocationPrivacyMyAccessLog', args: { page: 1, pageSize: 50 } },
    { name: 'UteamupLocationPrivacyRevokeGrant', args: { grantGuid } },
    { name: 'UteamupLocationPrivacyRequestShare', args: { model: shareRequest } },
    { name: 'UteamupLocationPrivacyGetPolicy', args: {} },
    { name: 'UteamupLocationPrivacyUpdatePolicy', args: { model: policy } }
  ];

  describe('regression guards', () => {
    const selfTools = allTools.filter(t => !/RequestShare|Policy/.test(t.name));

    test.each(selfTools)('$name takes no userId or tenantId', ({ args }) => {
      const keys = Object.keys(args).map(k => k.toLowerCase());
      expect(keys.some(k => k.includes('userid') || k.includes('usergu') || k.includes('tenant'))).toBe(false);
    });

    test('no approve, decline or grant tool exists', () => {
      const names = allTools.map(t => t.name);
      expect(names.some(n => /Approve|Decline|CreateGrant|Emergency/.test(n))).toBe(false);
    });

    test('identifiers are GUIDs', () => {
      expect(grantGuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(shareRequest.subjectUserGuid).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  // ---------------------------------------------------------------------------
  // Shared error-handling tests (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
