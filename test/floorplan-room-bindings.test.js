'use strict';
const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');

describe('Floorplan room bindings', () => {
  const base = 'https://api.uteamup.com';
  const locationGuid = '11111111-1111-4111-8111-111111111111';
  const nodeGuid = '22222222-2222-4222-8222-222222222222';
  const scene = {
    schemaVersion: 1, name: 'Room links', levels: [{ id: 'L0', name: 'Ground floor' }],
    rooms: [{ id: 'room1', levelId: 'L0', name: 'Living room', locationFloorGuid: nodeGuid,
      polygon: [[0, 0], [4, 0], [4, 4], [0, 4]] }],
    walls: [], openings: [], roofs: [], stairs: [], objects: [],
  };
  beforeAll(() => nock.disableNetConnect());
  afterEach(() => nock.cleanAll());
  afterAll(() => nock.enableNetConnect());

  test.each(['UteamupFloorplanSceneSave', 'UteamupFloorplanSceneGet'])('%s preserves the optional room node GUID', async (name) => {
    const args = name.endsWith('Save') ? { locationGuid, name: scene.name, expectedVersion: 0, scene } : { locationGuid };
    const saved = { locationGuid, version: 1, scene };
    const response = await callMcpTool(base, 'test-room-token', name, args, successReply(saved), args);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(saved);
    expect(nock.isDone()).toBe(true);
  });

  test('invalid or unauthorized node links retain the backend error', async () => {
    const args = { locationGuid, name: scene.name, expectedVersion: 0, scene };
    const response = await callMcpTool(base, 'test-room-token', 'UteamupFloorplanSceneSave', args,
      errorReply(-32602, 'floorplan-scene.item-forbidden'), args);
    expect(response.body.error.message).toBe('floorplan-scene.item-forbidden');
  });
});
