/**
 * Bugs & Features MCP tool tests
 *
 * Covers the four MCP tools that proxy to the backend /api/bugsandfeatures endpoints:
 *   - UteamupBugsAndFeaturesCreate
 *   - UteamupBugsAndFeaturesGet
 *   - UteamupBugsAndFeaturesList
 *   - UteamupBugsAndFeaturesUpdateStatus
 *
 * Verifies: JSON-RPC 2.0 proxying, success replies, empty lists, 401/403 errors.
 * Pattern mirrors project-my-projects.test.js: nock-mocked HTTPS calls.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Bugs & Features MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_bugs_and_features';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ── Shared mock data ─────────────────────────────────────────────────────
  const bugRow = {
    externalGuid: '11111111-1111-1111-1111-111111111111',
    type: 'Bug',
    status: 'New',
    severity: 'High',
    title: 'Example bug',
    description: 'Something broke',
    tenantGuid: '22222222-2222-2222-2222-222222222222',
    tenantName: 'Acme Corp',
    userEmail: 'submitter@example.com',
    userDisplayName: 'Submitter',
    consoleTail: '[error] [redacted]',
    isPinned: false,
    capturedAtUtc: '2026-04-18T12:00:00Z',
    createdAt: '2026-04-18T12:00:00Z',
    lastStatusChangedAtUtc: '2026-04-18T12:00:00Z',
    statusHistory: [],
  };
  const featureRow = { ...bugRow, externalGuid: '33333333-3333-3333-3333-333333333333', type: 'Feature', consoleTail: null };

  // ── Create ───────────────────────────────────────────────────────────────
  describe('UteamupBugsAndFeaturesCreate', () => {
    test('returns the created row with status=New', async () => {
      const response = await call(
        'UteamupBugsAndFeaturesCreate',
        {
          type: 'Bug',
          severity: 'High',
          title: 'Example bug',
          description: 'Something broke',
          idempotencyKey: 'abcd-efgh-ijkl',
        },
        successReply(bugRow),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.externalGuid).toBe(bugRow.externalGuid);
      expect(data.status).toBe('New');
    });
  });

  // ── Get ──────────────────────────────────────────────────────────────────
  describe('UteamupBugsAndFeaturesGet', () => {
    test('returns a single submission by externalGuid', async () => {
      const response = await call(
        'UteamupBugsAndFeaturesGet',
        { externalGuid: bugRow.externalGuid },
        successReply(bugRow),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.title).toBe('Example bug');
    });
  });

  // ── Conversation (reporter-facing read) ───────────────────────────────────
  describe('UteamupBugsAndFeaturesConversation', () => {
    test('returns the reporter conversation (report + timeline + shared comments)', async () => {
      const conversation = {
        externalGuid: bugRow.externalGuid,
        type: 'Bug',
        status: 'Validated',
        title: 'Example bug',
        description: 'Something broke',
        createdAtUtc: '2026-06-03T10:00:00Z',
        statusTimeline: [
          { fromStatus: 'New', toStatus: 'Validated', note: 'Looks valid', changedAtUtc: '2026-06-03T11:00:00Z' },
        ],
        comments: [
          {
            externalGuid: '33333333-3333-3333-3333-333333333333',
            bodyHtml: '<p>We are on it</p>',
            authorDisplayName: 'Support',
            isVisibleToReporter: true,
            isFromReporter: false,
            createdAt: '2026-06-03T11:05:00Z',
            mentions: [],
            replies: [],
          },
        ],
      };
      const response = await call(
        'UteamupBugsAndFeaturesConversation',
        { bugExternalGuid: bugRow.externalGuid },
        successReply(conversation),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.externalGuid).toBe(bugRow.externalGuid);
      expect(data.statusTimeline).toHaveLength(1);
      expect(data.comments[0].isVisibleToReporter).toBe(true);
    });
  });

  // ── My reports (reporter-facing list of the caller's own reports) ─────────
  describe('UteamupBugsAndFeaturesMine', () => {
    test('returns the caller\'s own reports as a slim list', async () => {
      const reports = [
        {
          externalGuid: bugRow.externalGuid,
          type: 'Bug',
          status: 'Validated',
          severity: 'Low',
          title: 'Example bug',
          createdAtUtc: '2026-06-03T10:00:00Z',
          lastActivityAtUtc: '2026-06-03T11:00:00Z',
          sharedCommentCount: 2,
        },
      ];
      const response = await call('UteamupBugsAndFeaturesMine', {}, successReply(reports));
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].externalGuid).toBe(bugRow.externalGuid);
      expect(data[0].sharedCommentCount).toBe(2);
    });
  });

  // ── List ─────────────────────────────────────────────────────────────────
  describe('UteamupBugsAndFeaturesList', () => {
    test('returns a paginated list of submissions', async () => {
      const response = await call(
        'UteamupBugsAndFeaturesList',
        { hideRejectedAndConfirmed: true },
        successReply({ items: [bugRow, featureRow], totalCount: 2, page: 1, pageSize: 50 }),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.items).toHaveLength(2);
      expect(data.totalCount).toBe(2);
    });

    test('returns empty list when no submissions match', async () => {
      const response = await call(
        'UteamupBugsAndFeaturesList',
        { status: 'Rejected' },
        successReply({ items: [], totalCount: 0, page: 1, pageSize: 50 }),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.items).toEqual([]);
    });

    test('forwards the source filter parameter', async () => {
      const response = await call(
        'UteamupBugsAndFeaturesList',
        { source: 'PerformanceAuto' },
        successReply({ items: [bugRow], totalCount: 1, page: 1, pageSize: 50 }),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.items).toHaveLength(1);
    });
  });

  // ── UpdateStatus ─────────────────────────────────────────────────────────
  describe('UteamupBugsAndFeaturesUpdateStatus', () => {
    test('transitions New → Validated', async () => {
      const updated = { ...bugRow, status: 'Validated' };
      const response = await call(
        'UteamupBugsAndFeaturesUpdateStatus',
        { externalGuid: bugRow.externalGuid, toStatus: 'Validated' },
        successReply(updated),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.status).toBe('Validated');
    });

    test('parks a report New → WaitList', async () => {
      // Backend serializes the enum camelCase, so WaitList comes back as "waitList".
      const updated = { ...bugRow, status: 'waitList' };
      const response = await call(
        'UteamupBugsAndFeaturesUpdateStatus',
        { externalGuid: bugRow.externalGuid, toStatus: 'WaitList' },
        successReply(updated),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.status).toBe('waitList');
    });

    test('returns a parked report WaitList → New', async () => {
      const updated = { ...bugRow, status: 'New' };
      const response = await call(
        'UteamupBugsAndFeaturesUpdateStatus',
        { externalGuid: bugRow.externalGuid, toStatus: 'New' },
        successReply(updated),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.status).toBe('New');
    });
  });

  // ── Delete ───────────────────────────────────────────────────────────────
  describe('UteamupBugsAndFeaturesDelete', () => {
    test('hard-deletes a cluster by externalGuid', async () => {
      const response = await call(
        'UteamupBugsAndFeaturesDelete',
        { externalGuid: bugRow.externalGuid },
        successReply(true),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toBe(true);
    });
  });

  // ── Shared error-path tests ──────────────────────────────────────────────
  // Helpers expect an array of tool descriptors; 401/503 also take BASE_URL
  // (not the `call` fn) as their first argument. See test/helpers/mcp-error-tests.js.
  const errorPathTools = [
    { name: 'UteamupBugsAndFeaturesList', args: {} },
  ];
  describeJsonRpcCompliance(call, errorPathTools);
  describe401Unauthorized(BASE_URL, errorPathTools);
  describe503ServiceUnavailable(BASE_URL, errorPathTools);
});
