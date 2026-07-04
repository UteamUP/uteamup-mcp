/**
 * UteamupCodeCatalogDuplicate MCP tool test.
 *
 * Backend tool: DuplicateCodeCatalogSubtreeByGuidCommand + Handler — deep-clones
 * a catalog-entry subtree (source + a selectable subset of its descendants) as a
 * numbered series of copies under a chosen parent, optionally cloning tagged assets.
 * Generic-proxy pattern (nock-mocked backend; no real network).
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

describe('UteamupCodeCatalogDuplicate MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_codecatalog_duplicate';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, 'UteamupCodeCatalogDuplicate', toolArgs, mockReply);

  const sourceGuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const targetParentGuid = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  const newRootGuid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const descendantGuid = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

  const sampleResult = {
    createdRoots: [
      {
        externalGuid: newRootGuid,
        name: 'Breaker Bay GE02',
        displayCode: 'GE02',
      },
    ],
    totalCodesCreated: 4,
    totalAssetsCreated: 2,
    skippedCableCount: 1,
  };

  // ---- happy path -------------------------------------------------------

  it('returns the duplication result with created roots and totals on success', async () => {
    const response = await call(
      { sourceGuid, copies: 1 },
      successReply(sampleResult),
    );
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.createdRoots).toHaveLength(1);
    expect(data.createdRoots[0].externalGuid).toBe(newRootGuid);
    expect(data.createdRoots[0].displayCode).toBe('GE02');
    expect(data.totalCodesCreated).toBe(4);
    expect(data.totalAssetsCreated).toBe(2);
    expect(data.skippedCableCount).toBe(1);
  });

  // ---- null response (source not found / wrong tenant) ------------------

  it('returns null when the source entry is not found or belongs to another tenant', async () => {
    const response = await call(
      { sourceGuid: 'dddddddd-dddd-dddd-dddd-dddddddddddd' },
      successReply(null),
    );
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toBeNull();
  });

  // ---- permission denied -----------------------------------------------

  it('surfaces backend permission-denied as a JSON-RPC error', async () => {
    const response = await call(
      { sourceGuid },
      errorReply(-32000, 'Permission denied: Coding.Create required'),
    );
    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/Permission denied/i);
  });

  // ---- validation error (empty source guid) ----------------------------

  it('surfaces a backend validation error for an empty source guid', async () => {
    const response = await call(
      { sourceGuid: '00000000-0000-0000-0000-000000000000' },
      errorReply(-32602, 'SourceGuid must not be empty'),
    );
    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/SourceGuid/i);
  });

  // ---- argument round-trip (proxy forwards all args verbatim) -----------

  it('forwards all optional arguments to the backend without modification', async () => {
    const response = await call(
      {
        sourceGuid,
        copies: 5,
        targetParentGuid,
        includeDescendantGuids: [descendantGuid],
        includeTaggedAssets: false,
        newRootCode: 'GE99',
      },
      successReply(sampleResult),
    );
    // nock only matches when params.name === 'UteamupCodeCatalogDuplicate';
    // a 200 confirms the proxy forwarded the full argument set intact.
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.createdRoots[0].externalGuid).toBe(newRootGuid);
  });

  // ---- regression guard: no userId / tenantId arg ----------------------

  it('does NOT expose userId or tenantId as a tool argument (identity comes from Bearer token)', async () => {
    const response = await call(
      { sourceGuid, userId: 'spoofed-user', tenantId: 'spoofed-tenant' },
      successReply(sampleResult),
    );
    expect(response.status).toBe(200);
  });

  // ---- standard compliance / error-handling suites ---------------------

  const complianceTools = [{ name: 'UteamupCodeCatalogDuplicate', args: { sourceGuid } }];

  describeJsonRpcCompliance(
    (name, args, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, name, args, mockReply),
    complianceTools,
  );
  describe401Unauthorized(BASE_URL, complianceTools);
  describe503ServiceUnavailable(BASE_URL, complianceTools);
});
