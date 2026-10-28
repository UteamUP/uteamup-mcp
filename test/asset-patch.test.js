/**
 * UteamupAssetPatch MCP tool test.
 *
 * Backend tool: PatchAssetByGuidCommand + Handler — changes only the fields passed on an asset
 * by ExternalGuid (mirrors PATCH /api/asset/by-guid/{guid}). An empty string clears a text field,
 * the empty GUID clears a link, and a stale expectedUpdatedAtUtc fails with asset_changed.
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

describe('UteamupAssetPatch MCP tool', () => {
  const BASE_URL = 'https://api.uteamup.com';
  const ACCESS_TOKEN = 'test_access_token_asset_patch';
  const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, 'UteamupAssetPatch', toolArgs, mockReply, expectedArgs);

  const assetGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const categoryGuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  it('keeps explicit document unlink and vendor GUID sets distinct from omitted fields', async () => {
    const args = { assetGuid, documentGuids: [], vendorGuids: [categoryGuid] };
    const response = await call(args, successReply(args), args);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.documentGuids).toEqual([]);
    expect(data.vendorGuids).toEqual([categoryGuid]);
    expect(data).not.toHaveProperty('name');
  });

  const patchedAsset = {
    assetGuid,
    name: 'Feed pump',
    serialNumber: 'SN-2',
    referenceNumber: '',
    modelNumber: 'CP-10',
    categoryGuid,
    categoryName: 'Rotating equipment',
    locationGuid: null,
    locationName: null,
    locationFloorGuid: null,
    locationFloorName: null,
    isActive: true,
    updatedAt: '2026-09-24T10:00:00.123456Z',
  };

  it('returns the patched asset with its new concurrency token', async () => {
    const response = await call({ assetGuid, serialNumber: 'SN-2' }, successReply(patchedAsset));

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.assetGuid).toBe(assetGuid);
    expect(data.serialNumber).toBe('SN-2');
    expect(data.updatedAt).toBe('2026-09-24T10:00:00.123456Z');
    expect(data).not.toHaveProperty('id');
  });

  it('forwards only the passed fields, verbatim, including an empty-GUID clear', async () => {
    const args = { assetGuid, categoryGuid: EMPTY_GUID, expectedUpdatedAtUtc: '2026-09-24T10:00:00.123456Z' };

    const response = await call(args, successReply({ ...patchedAsset, categoryGuid: null, categoryName: null }), args);

    // nock only matches when params.arguments deep-equal `args`, so a 200 proves the proxy
    // neither dropped nor added a field.
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.categoryGuid).toBeNull();
  });

  it('forwards the manufacturer vendor GUID verbatim and returns its name', async () => {
    const manufacturerVendorGuid = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const args = { assetGuid, manufacturerVendorGuid };

    const response = await call(
      args,
      successReply({ ...patchedAsset, manufacturerVendorGuid, manufacturerVendorName: 'Mitsubishi' }),
      args,
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.manufacturerVendorGuid).toBe(manufacturerVendorGuid);
    expect(data.manufacturerVendorName).toBe('Mitsubishi');
  });

  it('forwards tool, chemical and part sets verbatim, including an empty list that removes them', async () => {
    const toolGuid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const partGuid = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const args = {
      assetGuid,
      toolGuids: [toolGuid],
      chemicalGuids: [],
      assetParts: [{ partGuid, assignedQuantity: 2 }],
    };

    const response = await call(
      args,
      successReply({ ...patchedAsset, toolGuids: [toolGuid], chemicalGuids: [], assetParts: args.assetParts }),
      args,
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.toolGuids).toEqual([toolGuid]);
    expect(data.chemicalGuids).toEqual([]);
    expect(data.assetParts).toEqual([{ partGuid, assignedQuantity: 2 }]);
  });

  it('forwards the asset type set and primary type so a type can be added without a full update', async () => {
    const lightingGuid = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const energyGuid = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const args = { assetGuid, primaryAssetTypeGuid: energyGuid };

    const response = await call(
      args,
      successReply({ ...patchedAsset, primaryAssetTypeGuid: energyGuid, assetTypeGuids: [energyGuid, lightingGuid] }),
      args,
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.primaryAssetTypeGuid).toBe(energyGuid);
    expect(data.assetTypeGuids).toEqual([energyGuid, lightingGuid]);
  });

  // The backend throws McpException for a coded refusal. ModelContextProtocol 2.2.0 returns that as a
  // tool result with isError set, its text the SDK's prefix followed by the backend's "code: reason".
  const toolError = (text) => ({
    status: 200,
    body: {
      jsonrpc: '2.0',
      result: {
        content: [{ type: 'text', text: `An error occurred invoking 'uteamup_asset_patch': ${text}` }],
        isError: true,
      },
      id: 1,
    },
  });

  it('surfaces a stale token as a tool error naming asset_changed', async () => {
    const response = await call(
      { assetGuid, serialNumber: 'SN-3', expectedUpdatedAtUtc: '2020-01-01T00:00:00Z' },
      toolError('asset_changed: The asset was changed by someone else. Refresh and try again.'),
    );

    expect(response.body.error).toBeUndefined();
    expect(response.body.result.isError).toBe(true);
    expect(response.body.result.content[0].text).toContain('asset_changed: ');
  });

  it('surfaces a cross-tenant category as a tool error naming invalid_reference', async () => {
    const response = await call(
      { assetGuid, categoryGuid },
      toolError(`invalid_reference: The category ${categoryGuid} does not exist in this tenant.`),
    );

    expect(response.body.result.isError).toBe(true);
    expect(response.body.result.content[0].text).toContain('invalid_reference: ');
  });

  it('surfaces a duplicated tool as a tool error naming invalid_assignment', async () => {
    const toolGuid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const response = await call(
      { assetGuid, toolGuids: [toolGuid, toolGuid] },
      toolError('invalid_assignment: Each tool must be a distinct, nonempty GUID.'),
    );

    expect(response.body.result.isError).toBe(true);
    expect(response.body.result.content[0].text).toContain('invalid_assignment: ');
  });

  it('surfaces backend permission-denied as a JSON-RPC error', async () => {
    const response = await call(
      { assetGuid, name: 'New name' },
      errorReply(-32000, 'Permission denied: Asset.Update required'),
    );

    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/Permission denied/i);
  });

  it('does NOT act on a spoofed userId/tenantId (identity comes from the Bearer token)', async () => {
    const response = await call(
      { assetGuid, name: 'Pump', userId: 'spoofed-user', tenantId: 'spoofed-tenant' },
      successReply({ ...patchedAsset, name: 'Pump' }),
    );

    expect(response.status).toBe(200);
  });

  const complianceTools = [{ name: 'UteamupAssetPatch', args: { assetGuid, serialNumber: 'SN-9' } }];

  describeJsonRpcCompliance(
    (name, args, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, name, args, mockReply),
    complianceTools,
  );
  describe401Unauthorized(BASE_URL, complianceTools);
  describe503ServiceUnavailable(BASE_URL, complianceTools);
});
