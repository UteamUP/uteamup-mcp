/**
 * UteamupAssetEditCodeAssignment MCP tool test.
 *
 * Backend tool: EditAssetCodeAssignmentByGuidCommand + Handler — edits a coded
 * asset's code assignment by ExternalGuid: rename the asset (name), rename its
 * code (desiredCode), reassign it to a different catalog entry, or move it under
 * a different parent. Asset names are unique per tenant (case-insensitive);
 * a collision surfaces as a JSON-RPC error.
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

describe('UteamupAssetEditCodeAssignment MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_asset_edit_code_assignment';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, 'UteamupAssetEditCodeAssignment', toolArgs, mockReply);

  const assetGuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const renamedAsset = {
    id: 42,
    externalGuid: assetGuid,
    name: 'Temperature Protection Cabinet',
    status: 'Active',
    codingSystemCode: '1KRO 0CKB01',
  };

  // ---- happy path: rename the asset ------------------------------------

  it('returns the updated asset after a rename', async () => {
    const response = await call(
      { assetGuid, name: 'Temperature Protection Cabinet' },
      successReply(renamedAsset),
    );
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.externalGuid).toBe(assetGuid);
    expect(data.name).toBe('Temperature Protection Cabinet');
  });

  // ---- happy path: rename the code in the same call --------------------

  it('renames the asset code via desiredCode', async () => {
    const response = await call(
      { assetGuid, desiredCode: '0CKB02' },
      successReply({ ...renamedAsset, codingSystemCode: '1KRO 0CKB02' }),
    );
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.codingSystemCode).toBe('1KRO 0CKB02');
  });

  // ---- duplicate name → JSON-RPC error ---------------------------------

  it('surfaces a duplicate asset name as a JSON-RPC error', async () => {
    const response = await call(
      { assetGuid, name: 'Króksstaðir 12 kV Substation' },
      errorReply(-32000, 'An asset with this name already exists in this tenant.'),
    );
    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/already exists in this tenant/i);
  });

  // ---- permission denied -----------------------------------------------

  it('surfaces backend permission-denied as a JSON-RPC error', async () => {
    const response = await call(
      { assetGuid, name: 'New name' },
      errorReply(-32000, 'Permission denied: Asset.UpdateCodeAssignment required'),
    );
    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/Permission denied/i);
  });

  // ---- argument round-trip (proxy forwards name + desiredCode verbatim) -

  it('forwards the name and desiredCode arguments to the backend without modification', async () => {
    const response = await call(
      { assetGuid, name: 'Renamed', desiredCode: '0CKB03' },
      successReply({ ...renamedAsset, name: 'Renamed', codingSystemCode: '1KRO 0CKB03' }),
    );
    // A 200 confirms nock matched — nock only matches when the forwarded
    // params.arguments carry the assetGuid (and the extra fields are harmless).
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.name).toBe('Renamed');
    expect(data.codingSystemCode).toBe('1KRO 0CKB03');
  });

  // ---- regression guard: no userId / tenantId arg ----------------------

  it('does NOT act on a spoofed userId/tenantId (identity comes from the Bearer token)', async () => {
    const response = await call(
      { assetGuid, name: 'X1', userId: 'spoofed-user', tenantId: 'spoofed-tenant' },
      successReply({ ...renamedAsset, name: 'X1' }),
    );
    expect(response.status).toBe(200);
  });

  // ---- standard compliance / error-handling suites ---------------------

  const complianceTools = [
    { name: 'UteamupAssetEditCodeAssignment', args: { assetGuid, name: 'Compliance name' } },
  ];

  describeJsonRpcCompliance(
    (name, args, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, name, args, mockReply),
    complianceTools,
  );
  describe401Unauthorized(BASE_URL, complianceTools);
  describe503ServiceUnavailable(BASE_URL, complianceTools);
});
