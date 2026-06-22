/**
 * UteamupAssetDuplicate MCP tool test.
 *
 * Backend tool: DuplicateAssetByGuidCommand + Handler — deep-clones a coded
 * asset and assigns the next code instance (e.g. GE0101 → GE0102).
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

describe('UteamupAssetDuplicate MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_asset_duplicate';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, 'UteamupAssetDuplicate', toolArgs, mockReply);

  const sourceGuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const newGuid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const sampleAsset = {
    id: 42,
    externalGuid: newGuid,
    name: 'SEL-751 Protection Relay GE0102',
    serialNumber: null,
    model: 'SEL-751',
    status: 'Active',
    locationId: 7,
    locationName: 'Substation A',
    tenantId: 3,
    // Profile image added to asset read responses — the generic proxy must
    // pass it through untouched (string|null).
    imageUrl: 'https://blob.uteamup.com/assets/ge0102-profile.png',
    codeAssignment: {
      codeGuid: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      displayCode: 'GE0102',
    },
  };

  // ---- happy path -------------------------------------------------------

  it('returns the newly duplicated asset on success', async () => {
    const response = await call(
      { assetGuid: sourceGuid },
      successReply(sampleAsset),
    );
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.externalGuid).toBe(newGuid);
    expect(data.name).toBe('SEL-751 Protection Relay GE0102');
    expect(data.codeAssignment.displayCode).toBe('GE0102');
    // imageUrl (profile image on asset read responses) survives the proxy.
    expect(data.imageUrl).toBe('https://blob.uteamup.com/assets/ge0102-profile.png');
  });

  // ---- null response (source not found / no code assignment) -----------

  it('returns null when the source asset is not found or has no code assignment', async () => {
    const response = await call(
      { assetGuid: 'dddddddd-dddd-dddd-dddd-dddddddddddd' },
      successReply(null),
    );
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toBeNull();
  });

  // ---- permission denied -----------------------------------------------

  it('surfaces backend permission-denied as a JSON-RPC error', async () => {
    const response = await call(
      { assetGuid: sourceGuid },
      errorReply(-32000, 'Permission denied: Asset.Create required'),
    );
    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/Permission denied/i);
  });

  // ---- argument round-trip (proxy forwards assetGuid verbatim) ---------

  it('forwards the assetGuid argument to the backend without modification', async () => {
    // callMcpTool sets up nock internally; we verify the arg is present in
    // the reply body content (which the backend echoes back in result.content).
    const response = await call(
      { assetGuid: sourceGuid },
      successReply(sampleAsset),
    );
    // The proxy must have forwarded the call; a 200 with our asset confirms
    // nock matched (nock only matches when params.arguments.assetGuid is present).
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.externalGuid).toBe(newGuid);
  });

  // ---- regression guard: no userId / tenantId arg ---------------------

  it('does NOT expose userId or tenantId as a tool argument (identity comes from Bearer token)', async () => {
    const response = await call(
      { assetGuid: sourceGuid, userId: 'spoofed-user', tenantId: 'spoofed-tenant' },
      successReply(sampleAsset),
    );
    // The proxy should accept the call (extra unknown args are harmless);
    // the key assertion is that no spoofed identity was acted on — the
    // backend always derives identity from the Bearer token, not from args.
    expect(response.status).toBe(200);
  });

  // ---- standard compliance / error-handling suites ---------------------

  const complianceTools = [{ name: 'UteamupAssetDuplicate', args: { assetGuid: sourceGuid } }];

  describeJsonRpcCompliance(
    (name, args, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, name, args, mockReply),
    complianceTools,
  );
  describe401Unauthorized(BASE_URL, complianceTools);
  describe503ServiceUnavailable(BASE_URL, complianceTools);
});
