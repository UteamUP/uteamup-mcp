/** 3D model library and floorplan scene items MCP proxy contract tests. */
'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('3D model MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_model3d';

  const MODEL_GUID = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const DOCUMENT_GUID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
  const PART_GUID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
  const LOCATION_GUID = '71cfb161-1978-4c3e-aa7d-1f00b9be0790';

  const listTool = { name: 'uteamup_model3d_list', args: { search: 'pump', category: 'Part', page: 2, pageSize: 10 } };
  const getTool = { name: 'uteamup_model3d_get', args: { model3dGuid: MODEL_GUID } };
  const createTool = {
    name: 'uteamup_model3d_create',
    args: {
      name: 'Grundfos Alpha2',
      modelDocumentGuid: DOCUMENT_GUID,
      source: { schemaVersion: 1, unit: 'm', nodes: [], materials: [], textures: [] },
      category: 'Part',
      provenance: 'Imported',
      widthM: 0.16,
      heightM: 0.13,
      depthM: 0.1,
    },
  };
  const linkTool = { name: 'uteamup_model3d_link', args: { itemKind: 'Part', itemGuid: PART_GUID, model3dGuid: MODEL_GUID } };
  const resolveTool = { name: 'uteamup_model3d_resolve', args: { itemKind: 'Part', itemGuid: PART_GUID } };
  const deleteTool = { name: 'uteamup_model3d_delete', args: { model3dGuid: MODEL_GUID, force: true } };
  const duplicateTool = { name: 'uteamup_model3d_duplicate', args: { model3dGuid: MODEL_GUID, name: 'Grundfos Alpha2 (copy)' } };
  const itemsTool = { name: 'uteamup_floorplan_scene_items', args: { locationGuid: LOCATION_GUID } };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  const resultOf = (response) => JSON.parse(response.body.result.content[0].text);

  test('forwards list filters verbatim and passes the page through, keyed by GUID', async () => {
    const response = await call(listTool.name, listTool.args, successReply({
      items: [{
        guid: MODEL_GUID,
        name: 'Grundfos Alpha2',
        category: 'Part',
        provenance: 'Imported',
        modelDocumentGuid: DOCUMENT_GUID,
        widthM: 0.16, heightM: 0.13, depthM: 0.1,
        triangleCount: 1200, modelSizeBytes: 48000, linkedItemCount: 2,
      }],
      totalCount: 1, page: 2, pageSize: 10,
    }), listTool.args);

    const data = resultOf(response);
    expect(data.items[0].guid).toBe(MODEL_GUID);
    expect(data.items[0].linkedItemCount).toBe(2);
    expect(data.items[0]).not.toHaveProperty('id');
  });

  test('passes an empty library through as an empty page', async () => {
    const response = await call(listTool.name, {}, successReply({ items: [], totalCount: 0, page: 1, pageSize: 25 }), {});
    expect(resultOf(response).items).toEqual([]);
  });

  test('passes the editor source document through unchanged', async () => {
    const source = { schemaVersion: 1, unit: 'm', nodes: [{ id: 'n1', kind: 'box', params: { width: 0.3 } }], materials: [], textures: [] };
    const response = await call(getTool.name, getTool.args, successReply({ externalGuid: MODEL_GUID, name: 'Pump', source, version: 3 }), getTool.args);
    const data = resultOf(response);
    expect(data.source).toEqual(source);
    expect(data.version).toBe(3);
  });

  test('forwards the create body, including the nested source, verbatim', async () => {
    const response = await call(createTool.name, createTool.args, successReply({ externalGuid: MODEL_GUID, version: 1, linkedItemCount: 0 }), createTool.args);
    expect(resultOf(response).externalGuid).toBe(MODEL_GUID);
  });

  test('link sends kind, item and model; omitting the model clears it', async () => {
    const linked = await call(linkTool.name, linkTool.args,
      successReply({ itemKind: 'Part', itemGuid: PART_GUID, source: 'Library', model3DGuid: MODEL_GUID }), linkTool.args);
    expect(resultOf(linked).source).toBe('Library');

    const clearArgs = { itemKind: 'Part', itemGuid: PART_GUID };
    const cleared = await call(linkTool.name, clearArgs, successReply({ itemKind: 'Part', itemGuid: PART_GUID, source: 'None' }), clearArgs);
    expect(resultOf(cleared).source).toBe('None');
  });

  test('resolve passes the digital twin fallback through', async () => {
    const response = await call(resolveTool.name, resolveTool.args,
      successReply({ itemKind: 'Part', itemGuid: PART_GUID, source: 'DigitalTwin', modelDocumentGuid: DOCUMENT_GUID, format: 'GLB' }), resolveTool.args);
    expect(resultOf(response)).toMatchObject({ source: 'DigitalTwin', format: 'GLB' });
  });

  test('delete forwards force and passes the unlinked count through', async () => {
    const response = await call(deleteTool.name, deleteTool.args, successReply({ deleted: true, unlinkedItemCount: 2 }), deleteTool.args);
    expect(resultOf(response)).toEqual({ deleted: true, unlinkedItemCount: 2 });
  });

  test('duplicate forwards the source GUID and name and passes the new, unlinked copy through', async () => {
    const COPY_GUID = '9b2f7c1e-4a3d-4e5f-8a6b-1c2d3e4f5a6b';
    const response = await call(duplicateTool.name, duplicateTool.args, successReply({
      externalGuid: COPY_GUID, name: 'Grundfos Alpha2 (copy)', modelDocumentGuid: DOCUMENT_GUID, version: 1, linkedItemCount: 0,
    }), duplicateTool.args);

    const data = resultOf(response);
    expect(data.externalGuid).toBe(COPY_GUID);
    expect(data.externalGuid).not.toBe(MODEL_GUID);
    expect(data).toMatchObject({ version: 1, linkedItemCount: 0, modelDocumentGuid: DOCUMENT_GUID });
  });

  test('passes a duplicate of a model outside the tenant through as not found', async () => {
    const response = await call(duplicateTool.name, duplicateTool.args, errorReply(-32000, 'model3d.not-found'));
    expect(response.body.error.message).toBe('model3d.not-found');
    expect(response.body.result).toBeUndefined();
  });

  test('scene items keep restricted entries without a name or GUID', async () => {
    const response = await call(itemsTool.name, itemsTool.args, successReply({
      locationGuid: LOCATION_GUID,
      items: [
        { objectId: 'cam', restricted: false, missing: false, item: { itemKind: 'Asset', itemGuid: PART_GUID, name: 'Eufy Indoor Cam', source: 'None' } },
        { objectId: 'secret', restricted: true, missing: false },
        { objectId: 'gone', restricted: false, missing: true },
      ],
    }), itemsTool.args);

    const data = resultOf(response);
    expect(data.items).toHaveLength(3);
    expect(data.items[1]).toEqual({ objectId: 'secret', restricted: true, missing: false });
    expect(data.items[2].missing).toBe(true);
  });

  test('passes the in-use refusal through as an error', async () => {
    const response = await call(deleteTool.name, { model3dGuid: MODEL_GUID }, errorReply(-32000, 'model3d.in-use'));
    expect(response.body.error.message).toBe('model3d.in-use');
    expect(response.body.result).toBeUndefined();
  });

  test('passes a forbidden link through as an error', async () => {
    const response = await call(linkTool.name, linkTool.args, errorReply(-32000, 'model3d.forbidden'));
    expect(response.body.error.message).toBe('model3d.forbidden');
  });

  test('no tool takes a tenant or user id; identity comes from the token', () => {
    for (const tool of [listTool, getTool, createTool, linkTool, resolveTool, deleteTool, duplicateTool, itemsTool]) {
      for (const key of Object.keys(tool.args)) {
        expect(key).not.toMatch(/^(tenant|user)(Id|Guid)$/i);
        expect(key).not.toMatch(/Id$/);
      }
    }
  });

  const tools = [listTool, getTool, createTool, linkTool, resolveTool, deleteTool, duplicateTool, itemsTool];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
