/** Floorplan phone-scan draft MCP proxy contract tests. */
'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Floorplan scan draft MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_floorplan_scan';

  const LOCATION_GUID = '71cfb161-1978-4c3e-aa7d-1f00b9be0790';
  const FLOOR_GUID = 'c2d6a4e8-3f1b-4a7d-9e5c-8b0f2d4a6c13';
  const DRAFT_GUID = 'e4b8f1a2-6c3d-4e9f-a7b5-1d2c3e4f5a6b';
  const OLDER_DRAFT_GUID = 'a9f3c7e1-2b4d-4f6a-8c0e-5d7b9f1a3c25';
  const TEXTURE_DOCUMENT_GUID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
  const ASSET_GUID = '3b241101-e2bb-4255-8caf-4136c566a962';
  const PART_GUID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';

  const listTool = { name: 'uteamup_floorplan_scan_draft_list', args: { locationGuid: LOCATION_GUID } };
  const getTool = { name: 'uteamup_floorplan_scan_draft_get', args: { locationGuid: LOCATION_GUID, draftGuid: DRAFT_GUID } };

  const tools = [listTool, getTool];

  const readyDraft = {
    draftGuid: DRAFT_GUID,
    locationGuid: LOCATION_GUID,
    locationFloorGuid: FLOOR_GUID,
    status: 'ready',
    failureReason: null,
    baseSceneVersion: 4,
    device: 'iPhone 15 Pro',
    wallCount: 6,
    suggestionCount: 2,
    createdAt: '2026-10-20T08:12:00Z',
    processedAt: '2026-10-20T08:12:41Z',
    appliedAt: null,
    discardedAt: null,
  };

  const draftLevel = {
    level: { id: 'level-1', name: 'Ground floor', elevationM: 0, heightM: 2.7 },
    walls: [
      {
        id: 'wall-1',
        start: [0, 0],
        end: [4.2, 0],
        thicknessM: 0.12,
        heightM: 2.7,
        textureDocumentGuid: TEXTURE_DOCUMENT_GUID,
        textureSide: 'front',
      },
      { id: 'wall-2', start: [4.2, 0], end: [4.2, 3.6], thicknessM: 0.12, heightM: 2.7 },
    ],
    openings: [{ id: 'opening-1', wallId: 'wall-1', kind: 'door', offsetM: 1.1, widthM: 0.9, heightM: 2.1 }],
    rooms: [{ id: 'room-1', name: 'Plant room', polygon: [[0, 0], [4.2, 0], [4.2, 3.6], [0, 3.6]] }],
    objects: [
      { id: 'object-1', category: 'storage', position: [1, 0, 1], size: [0.6, 1.8, 0.4] },
      { id: 'object-2', category: 'table', position: [3, 0, 2], size: [1.2, 0.75, 0.8] },
    ],
  };

  const suggestions = [
    {
      objectId: 'object-1',
      itemKind: 'asset',
      itemGuid: ASSET_GUID,
      itemName: 'Pump P-101',
      match: 'exact',
      confidence: 1,
      reason: 'Tag scanned at this point',
    },
    {
      objectId: 'object-2',
      itemKind: 'part',
      itemGuid: PART_GUID,
      itemName: 'Workbench',
      match: 'category',
      confidence: 0.62,
      reason: 'Detected furniture type: table',
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  const resultOf = (response) => JSON.parse(response.body.result.content[0].text);

  test('list forwards the location GUID verbatim and passes every draft status through, newest first', async () => {
    const response = await call(listTool.name, listTool.args, successReply([
      readyDraft,
      { ...readyDraft, draftGuid: OLDER_DRAFT_GUID, status: 'processing', processedAt: null, wallCount: 0, suggestionCount: 0 },
      { ...readyDraft, draftGuid: OLDER_DRAFT_GUID, status: 'failed', failureReason: 'scan-unreadable', wallCount: 0, suggestionCount: 0 },
      { ...readyDraft, draftGuid: OLDER_DRAFT_GUID, status: 'applied', appliedAt: '2026-10-19T15:00:00Z' },
      { ...readyDraft, draftGuid: OLDER_DRAFT_GUID, status: 'discarded', discardedAt: '2026-10-18T10:00:00Z' },
    ]), listTool.args);

    const data = resultOf(response);
    expect(data.map((draft) => draft.status)).toEqual(['ready', 'processing', 'failed', 'applied', 'discarded']);
    expect(data[0]).toMatchObject({
      draftGuid: DRAFT_GUID,
      locationGuid: LOCATION_GUID,
      locationFloorGuid: FLOOR_GUID,
      baseSceneVersion: 4,
      device: 'iPhone 15 Pro',
      wallCount: 6,
      suggestionCount: 2,
    });
    expect(data[2].failureReason).toBe('scan-unreadable');
    expect(data[3].appliedAt).toBe('2026-10-19T15:00:00Z');
    expect(data[4].discardedAt).toBe('2026-10-18T10:00:00Z');
  });

  test('a list summary carries no geometry and no integer id', async () => {
    const response = await call(listTool.name, listTool.args, successReply([readyDraft]), listTool.args);
    const [summary] = resultOf(response);
    expect(summary).not.toHaveProperty('draftLevel');
    expect(summary).not.toHaveProperty('suggestions');
    expect(summary).not.toHaveProperty('id');
  });

  test('list passes a location with no scans through as an empty array', async () => {
    const response = await call(listTool.name, listTool.args, successReply([]), listTool.args);
    expect(resultOf(response)).toEqual([]);
  });

  test('get forwards both GUIDs verbatim and passes the draft level through unchanged', async () => {
    const response = await call(getTool.name, getTool.args,
      successReply({ ...readyDraft, draftLevel, suggestions }), getTool.args);

    const data = resultOf(response);
    expect(data).toMatchObject({ draftGuid: DRAFT_GUID, locationGuid: LOCATION_GUID, status: 'ready' });
    expect(data.draftLevel).toEqual(draftLevel);
    expect(data.draftLevel.walls[0]).toMatchObject({ textureDocumentGuid: TEXTURE_DOCUMENT_GUID, textureSide: 'front' });
    expect(data.draftLevel.walls[1]).not.toHaveProperty('textureDocumentGuid');
  });

  test('get passes exact and category suggestions through with their confidence and reason', async () => {
    const response = await call(getTool.name, getTool.args,
      successReply({ ...readyDraft, draftLevel, suggestions }), getTool.args);

    const data = resultOf(response);
    expect(data.suggestions).toEqual(suggestions);
    expect(data.suggestions.map((suggestion) => suggestion.match)).toEqual(['exact', 'category']);
    expect(data.suggestions[1].confidence).toBeCloseTo(0.62);
  });

  test('get passes a failed draft with no level and no suggestions through', async () => {
    const response = await call(getTool.name, getTool.args, successReply({
      ...readyDraft,
      status: 'failed',
      failureReason: 'scan-unreadable',
      wallCount: 0,
      suggestionCount: 0,
      draftLevel: null,
      suggestions: [],
    }), getTool.args);

    const data = resultOf(response);
    expect(data.status).toBe('failed');
    expect(data.draftLevel).toBeNull();
    expect(data.suggestions).toEqual([]);
  });

  test('passes floorplan-scan.not-found through as an error for an unknown location', async () => {
    const response = await call(listTool.name, listTool.args, errorReply(-32000, 'floorplan-scan.not-found'), listTool.args);
    expect(response.body.error.message).toBe('floorplan-scan.not-found');
    expect(response.body.result).toBeUndefined();
  });

  test('passes floorplan-scan.not-found through as an error for an unknown draft', async () => {
    const response = await call(getTool.name, getTool.args, errorReply(-32000, 'floorplan-scan.not-found'), getTool.args);
    expect(response.body.error.message).toBe('floorplan-scan.not-found');
    expect(response.body.result).toBeUndefined();
  });

  test('no tool call sends a tenant or user argument or an integer id; identity comes from the token', async () => {
    for (const tool of tools) {
      for (const key of Object.keys(tool.args)) {
        expect(key).not.toMatch(/tenant|user/i);
        expect(key).not.toMatch(/Id$/);
        expect(key).toMatch(/Guid$/);
      }
      // The mocked backend only answers when the forwarded arguments are exactly these.
      const response = await call(tool.name, tool.args, successReply({}), tool.args);
      expect(response.body.error).toBeUndefined();
    }
  });

  test('both scan draft tools are read only', () => {
    for (const tool of tools) {
      expect(tool.name).not.toMatch(/apply|discard|save|delete|create|update/);
    }
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
