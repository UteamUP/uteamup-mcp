/**
 * UteamupAssetTypeArchive and UteamupAssetTypeRestore MCP tool tests.
 *
 * Backend tools: ArchiveAssetTypeCommand / RestoreAssetTypeCommand + AssetTypeArchiveCommandHandler.
 * An asset type that assets, subtypes or recorded readings use is archived instead of deleted: it leaves type
 * lists and pickers, assets that carry it keep it. System types are refused with system_type. Both tools need
 * AssetType.Delete. Asset types are archived, never deleted: the deprecated UteamupAssetTypeDelete archives the
 * type too and returns true.
 *
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
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Asset type archive MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_asset_type_archive';

  const TYPE = 'cccccccc-0000-4000-8000-000000000001';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (tool, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, tool, toolArgs, mockReply);

  it('archives a custom asset type and returns when it was archived', async () => {
    const response = await call(
      'UteamupAssetTypeArchive',
      { assetTypeGuid: TYPE },
      successReply({ guid: TYPE, isActive: false, archivedAtUtc: '2026-11-06T12:00:00Z' }),
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.guid).toBe(TYPE);
    expect(data.isActive).toBe(false);
    expect(data.archivedAtUtc).toBeTruthy();
  });

  it('restores an archived asset type', async () => {
    const response = await call(
      'UteamupAssetTypeRestore',
      { assetTypeGuid: TYPE },
      successReply({ guid: TYPE, isActive: true, archivedAtUtc: null }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.isActive).toBe(true);
    expect(data.archivedAtUtc).toBeNull();
  });

  it('surfaces a system type as system_type', async () => {
    const response = await call(
      'UteamupAssetTypeArchive',
      { assetTypeGuid: TYPE },
      errorReply(-32000, 'system_type: System asset types are shared by every organisation and cannot be archived, restored or deleted.'),
    );

    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/system_type/);
  });

  it('surfaces a missing AssetType.Delete as a JSON-RPC error', async () => {
    const response = await call(
      'UteamupAssetTypeRestore',
      { assetTypeGuid: TYPE },
      errorReply(-32000, 'Permission denied: AssetType.Delete required'),
    );

    expect(response.body.error.message).toMatch(/AssetType\.Delete/);
  });

  it('surfaces a type outside the tenant as not_found', async () => {
    const response = await call(
      'UteamupAssetTypeArchive',
      { assetTypeGuid: TYPE },
      errorReply(-32000, 'not_found: Asset type unavailable.'),
    );

    expect(response.body.error.message).toMatch(/not_found/);
  });

  it('archives through the deprecated delete tool instead of deleting', async () => {
    const response = await call('UteamupAssetTypeDelete', { assetTypeGuid: TYPE }, successReply(true));

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toBe(true);
  });

  const errorTools = [
    { name: 'UteamupAssetTypeArchive', args: { assetTypeGuid: TYPE } },
    { name: 'UteamupAssetTypeRestore', args: { assetTypeGuid: TYPE } },
  ];
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
