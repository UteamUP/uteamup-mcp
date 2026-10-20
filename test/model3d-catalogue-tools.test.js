/** Cross-company 3D model catalogue MCP proxy contract tests. */
'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('3D model catalogue MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_model3d_catalogue';

  const ENTRY_GUID = '3b241101-e2bb-4255-8caf-4136c566a962';
  const MODEL_GUID = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const COPY_GUID = '9a1c5e2f-6b3d-4f7a-8e9c-0d1b2a3c4e5f';
  const PART_GUID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';

  const searchTool = {
    name: 'uteamup_model3d_catalogue_search',
    args: {
      search: 'alpha2',
      manufacturer: 'Grundfos',
      modelNumber: 'ALPHA2 25-60',
      partNumber: '99411165',
      gtin: '5712604123456',
      category: 'Part',
      page: 1,
      pageSize: 20,
    },
  };
  const getTool = { name: 'uteamup_model3d_catalogue_get', args: { entryGuid: ENTRY_GUID } };
  const copyTool = { name: 'uteamup_model3d_catalogue_copy', args: { entryGuid: ENTRY_GUID, itemKind: 'Part', itemGuid: PART_GUID } };
  const shareTool = {
    name: 'uteamup_model3d_catalogue_share',
    args: {
      model3dGuid: MODEL_GUID,
      name: 'Grundfos Alpha2 25-60',
      rightsConfirmed: true,
      category: 'Part',
      manufacturer: 'Grundfos',
      modelNumber: 'ALPHA2 25-60',
      partNumber: '99411165',
      gtin: '5712604123456',
      containsOnlinePhotos: true,
    },
  };
  const withdrawTool = { name: 'uteamup_model3d_catalogue_withdraw', args: { entryGuid: ENTRY_GUID } };
  const mineTool = { name: 'uteamup_model3d_catalogue_mine', args: {} };

  const tools = [searchTool, getTool, copyTool, shareTool, withdrawTool, mineTool];

  const catalogueEntry = {
    entryGuid: ENTRY_GUID,
    version: 2,
    name: 'Grundfos Alpha2 25-60',
    category: 'part',
    manufacturer: 'Grundfos',
    modelNumber: 'ALPHA2 25-60',
    partNumber: '99411165',
    gtin: '5712604123456',
    widthM: 0.16,
    heightM: 0.13,
    depthM: 0.1,
    triangleCount: 1200,
    totalBytes: 480000,
    thumbnailKey: 'thumbnail.png',
    publishedAt: '2026-10-20T09:00:00Z',
    matchScore: 100,
  };
  const myEntry = {
    entryGuid: ENTRY_GUID,
    sourceModel3DGuid: MODEL_GUID,
    name: 'Grundfos Alpha2 25-60',
    status: 'pending',
    pendingVersion: 1,
    updatedAt: '2026-10-20T09:00:00Z',
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  const resultOf = (response) => JSON.parse(response.body.result.content[0].text);

  test('search forwards every identity filter verbatim and passes the ranked page through', async () => {
    const response = await call(searchTool.name, searchTool.args,
      successReply({ items: [catalogueEntry, { ...catalogueEntry, entryGuid: COPY_GUID, matchScore: 40 }], totalCount: 2, page: 1, pageSize: 20 }),
      searchTool.args);

    const data = resultOf(response);
    expect(data.totalCount).toBe(2);
    expect(data.items.map((item) => item.matchScore)).toEqual([100, 40]);
    expect(data.items[0]).not.toHaveProperty('id');
  });

  test('search with no filters passes an empty catalogue through as an empty page', async () => {
    const response = await call(searchTool.name, {}, successReply({ items: [], totalCount: 0, page: 1, pageSize: 20 }), {});
    expect(resultOf(response).items).toEqual([]);
  });

  test('a catalogue entry never carries the sharing tenant or user', async () => {
    const response = await call(getTool.name, getTool.args, successReply(catalogueEntry), getTool.args);
    const data = resultOf(response);
    expect(data).toMatchObject({ entryGuid: ENTRY_GUID, version: 2, category: 'part' });
    for (const key of Object.keys(data)) {
      expect(key).not.toMatch(/tenant|user|sharedBy/i);
    }
  });

  test('copy sends the entry and optional item link and passes the new model through', async () => {
    const response = await call(copyTool.name, copyTool.args, successReply({
      model: { externalGuid: COPY_GUID, name: 'Grundfos Alpha2 25-60', provenance: 'shared', catalogueEntryGuid: ENTRY_GUID, catalogueVersion: 2 },
      linked: { itemKind: 'part', itemGuid: PART_GUID, source: 'library', model3DGuid: COPY_GUID },
    }), copyTool.args);

    const data = resultOf(response);
    expect(data.model).toMatchObject({ provenance: 'shared', catalogueEntryGuid: ENTRY_GUID, catalogueVersion: 2 });
    expect(data.linked.itemGuid).toBe(PART_GUID);
  });

  test('copy without an item returns no link', async () => {
    const args = { entryGuid: ENTRY_GUID };
    const response = await call(copyTool.name, args, successReply({ model: { externalGuid: COPY_GUID }, linked: null }), args);
    expect(resultOf(response).linked).toBeNull();
  });

  test('share forwards the identity, rights confirmation and online-photo flag verbatim', async () => {
    const response = await call(shareTool.name, shareTool.args, successReply(myEntry), shareTool.args);
    expect(resultOf(response)).toMatchObject({ entryGuid: ENTRY_GUID, status: 'pending', pendingVersion: 1 });
  });

  test('withdraw passes the withdrawn entry through', async () => {
    const response = await call(withdrawTool.name, withdrawTool.args,
      successReply({ ...myEntry, status: 'withdrawn', publishedVersion: 1, pendingVersion: null }), withdrawTool.args);
    expect(resultOf(response).status).toBe('withdrawn');
  });

  test('mine passes every review status and the reject reason through', async () => {
    const response = await call(mineTool.name, mineTool.args, successReply([
      myEntry,
      { ...myEntry, entryGuid: COPY_GUID, status: 'rejected', rejectReason: 'Wrong manufacturer', pendingVersion: null },
    ]), mineTool.args);

    const data = resultOf(response);
    expect(data.map((entry) => entry.status)).toEqual(['pending', 'rejected']);
    expect(data[1].rejectReason).toBe('Wrong manufacturer');
  });

  test('passes model3d.catalogue-not-found through as an error', async () => {
    const response = await call(getTool.name, getTool.args, errorReply(-32000, 'model3d.catalogue-not-found'));
    expect(response.body.error.message).toBe('model3d.catalogue-not-found');
    expect(response.body.result).toBeUndefined();
  });

  test('passes an unconfirmed share refusal through as an error', async () => {
    const args = { ...shareTool.args, rightsConfirmed: false };
    const response = await call(shareTool.name, args, errorReply(-32000, 'model3d.catalogue-rights-not-confirmed'));
    expect(response.body.error.message).toBe('model3d.catalogue-rights-not-confirmed');
  });

  test('no tool call sends a tenant or user argument; identity comes from the token', async () => {
    for (const tool of tools) {
      for (const key of Object.keys(tool.args)) {
        expect(key).not.toMatch(/tenant|user/i);
        expect(key).not.toMatch(/Id$/);
      }
      // The mocked backend only answers when the forwarded arguments are exactly these.
      const response = await call(tool.name, tool.args, successReply({}), tool.args);
      expect(response.body.error).toBeUndefined();
    }
  });

  test('no catalogue moderation tool is exposed to tenants', () => {
    for (const tool of tools) {
      expect(tool.name).not.toMatch(/approve|reject|admin|moderat/);
    }
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
