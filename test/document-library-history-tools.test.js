'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Document library history read contract', () => {
  const baseUrl = 'https://api.uteamup.com';
  const at = '2026-11-01T23:59:59.000Z';
  const tools = [
    { name: 'UteamupDocumentGetLibraryHistory', args: {} },
    { name: 'UteamupDocumentGetArchivedLibraryHistory', args: {} },
  ];
  const call = (name, args, response, expectedArgs) => callMcpTool(baseUrl, 'fixture-token', name, args, response, expectedArgs);
  beforeAll(() => nock.disableNetConnect());
  afterAll(() => nock.enableNetConnect());
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test.each(tools)('$name preserves unknown coverage and exact version identities', async ({ name }) => {
    const payload = {
      at, includesCurrentArchived: name.includes('Archived'), inspectedCount: 2,
      unknownMembershipCount: 1, unavailableVersionCount: 0, snapshotScanIncomplete: false,
      hasMore: true, nextCursor: 'opaque+/=', pageMembershipComplete: false,
      items: [
        { documentGuid: '11111111-1111-4111-8111-111111111111', currentFileName: 'current.pdf',
          membershipKnown: true, existsAtInstant: true, isArchivedAtInstant: false,
          fileName: 'historical.pdf', versionNumber: 2,
          documentVersionGuid: '22222222-2222-4222-8222-222222222222', versionAvailability: 'available' },
        { documentGuid: '33333333-3333-4333-8333-333333333333', currentFileName: 'legacy.pdf',
          membershipKnown: false, existsAtInstant: null, versionAvailability: 'unknown', documentVersionGuid: null },
      ],
    };
    const response = await call(name, { at, pageSize: 2 }, successReply(payload));
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toEqual(payload);
    expect(data.items[0].fileName).not.toBe(data.items[0].currentFileName);
    expect(data.items[1].documentVersionGuid).toBeNull();
    expect(data.pageMembershipComplete).toBe(false);
  });

  test.each(tools)('$name forwards the opaque cursor without identity overrides', async ({ name }) => {
    const args = { at, cursor: 'opaque+/=', pageSize: 25 };
    const response = await call(name, args, successReply({ at, items: [], hasMore: false }), args);
    expect(response.status).toBe(200);
    expect(nock.isDone()).toBe(true);
    expect(Object.keys(args)).toEqual(['at', 'cursor', 'pageSize']);
  });

  test.each(tools)('$name retains a complete empty page', async ({ name }) => {
    const payload = { at, items: [], inspectedCount: 0, hasMore: false, pageMembershipComplete: true };
    const response = await call(name, {}, successReply(payload));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(payload);
  });

  test('an archived read refusal remains an authorization error', async () => {
    const response = await call(tools[1].name, {}, errorReply(-32603, 'Document.Archive.Read required'));
    expect(response.body.error.message).toBe('Document.Archive.Read required');
    expect(response.body.result).toBeUndefined();
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
