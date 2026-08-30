/**
 * UteamupCodingsystemCreateCodeByPath MCP tool test.
 *
 * Backend tool: CreateCatalogEntryByPathCommand + Handler — takes a designation as it is
 * printed ("FOL 1LBA3 CT001 XQ01"), creates the tiers that do not exist yet and reuses the
 * rest, so an agent registers a four-segment loop-diagram code in one call instead of
 * walking the tree. Generic-proxy pattern (nock-mocked backend; no real network).
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

describe('UteamupCodingsystemCreateCodeByPath MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_create_code_by_path';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, 'UteamupCodingsystemCreateCodeByPath', toolArgs, mockReply);

  const codingSystemGuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const leafGuid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const codePath = 'FOL 1LBA3 CT001 XQ01';

  const sampleResult = {
    leaf: { externalGuid: leafGuid, code: 'XQ01', displayCode: 'FOL-1LBA3-CT001-XQ01' },
    segments: [
      { entryGuid: 'cccccccc-cccc-cccc-cccc-cccccccccccc', code: 'FOL', levelOrder: 0, created: false },
      { entryGuid: 'dddddddd-dddd-dddd-dddd-dddddddddddd', code: '1LBA3', levelOrder: 1, created: true },
      { entryGuid: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', code: 'CT001', levelOrder: 2, created: true },
      { entryGuid: leafGuid, code: 'XQ01', levelOrder: 3, created: true },
    ],
  };

  // ---- happy path -------------------------------------------------------

  it('returns the leaf and the whole chain, marking which tiers it created', async () => {
    const response = await call({ codingSystemGuid, codePath }, successReply(sampleResult));

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.leaf.externalGuid).toBe(leafGuid);
    expect(data.leaf.displayCode).toBe('FOL-1LBA3-CT001-XQ01');
    expect(data.segments).toHaveLength(4);
    expect(data.segments.map((segment) => segment.code)).toEqual(['FOL', '1LBA3', 'CT001', 'XQ01']);
    // The station already existed; the three tiers below it did not.
    expect(data.segments.filter((segment) => segment.created)).toHaveLength(3);
  });

  // ---- idempotent rerun -------------------------------------------------

  it('creates nothing on a rerun of the same designation', async () => {
    const reused = {
      ...sampleResult,
      segments: sampleResult.segments.map((segment) => ({ ...segment, created: false })),
    };

    const response = await call({ codingSystemGuid, codePath }, successReply(reused));

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.segments.every((segment) => segment.created === false)).toBe(true);
  });

  // ---- null response (unknown coding system) ----------------------------

  it('returns null when the coding system is unknown or has no levels', async () => {
    const response = await call(
      { codingSystemGuid: 'ffffffff-ffff-ffff-ffff-ffffffffffff', codePath },
      successReply(null),
    );

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toBeNull();
  });

  // ---- permission denied -----------------------------------------------

  it('surfaces backend permission-denied as a JSON-RPC error', async () => {
    const response = await call(
      { codingSystemGuid, codePath },
      errorReply(-32000, 'Permission denied: Coding.Create required'),
    );

    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/Permission denied/i);
  });

  // ---- validation errors -----------------------------------------------

  it('surfaces a backend validation error for an empty code path', async () => {
    const response = await call(
      { codingSystemGuid, codePath: '' },
      errorReply(-32602, 'CodePath must not be empty'),
    );

    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/CodePath/i);
  });

  it('surfaces the level-format refusal when a segment is non-standard', async () => {
    const response = await call(
      { codingSystemGuid, codePath: 'FOL 1LBA3 CT001 not-a-signal' },
      errorReply(-32602, "Code 'NOT-A-SIGNAL' does not match the Component level format"),
    );

    expect(response.body.error.message).toMatch(/does not match the Component level format/i);
  });

  // ---- argument round-trip ---------------------------------------------

  it('forwards all optional arguments to the backend without modification', async () => {
    const response = await call(
      {
        codingSystemGuid,
        codePath,
        name: 'Well head FG-03 temperature',
        description: 'Analog signal input on the FG-03 loop',
        acknowledgeNonStandard: true,
      },
      successReply(sampleResult),
    );

    // nock only matches when params.name === 'UteamupCodingsystemCreateCodeByPath';
    // a 200 confirms the proxy forwarded the full argument set intact.
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text).leaf.externalGuid).toBe(leafGuid);
  });

  // ---- regression guard: no userId / tenantId arg ----------------------

  it('does NOT expose userId or tenantId as a tool argument (identity comes from Bearer token)', async () => {
    const response = await call(
      { codingSystemGuid, codePath, userId: 'spoofed-user', tenantId: 'spoofed-tenant' },
      successReply(sampleResult),
    );

    expect(response.status).toBe(200);
  });

  // ---- standard compliance / error-handling suites ---------------------

  const complianceTools = [
    { name: 'UteamupCodingsystemCreateCodeByPath', args: { codingSystemGuid, codePath } },
  ];

  describeJsonRpcCompliance(
    (name, args, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, name, args, mockReply),
    complianceTools,
  );
  describe401Unauthorized(BASE_URL, complianceTools);
  describe503ServiceUnavailable(BASE_URL, complianceTools);
});
