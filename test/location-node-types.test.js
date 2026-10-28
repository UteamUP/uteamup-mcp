'use strict';
const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Location node type catalog and typed node reads', () => {
  const base = 'https://api.uteamup.com';
  const typeGuid = '11111111-1111-4111-8111-111111111111';
  const locationGuid = '22222222-2222-4222-8222-222222222222';
  const nodeGuid = '33333333-3333-4333-8333-333333333333';
  const type = { guid: typeGuid, name: 'Room', isSystem: true, displayOrder: 1 };
  const cases = [
    { name: 'UteamupLocationNodeTypeList', args: {}, result: [type] },
    { name: 'UteamupLocationNodeTypeCreate', args: { model: { name: 'Plant room', displayOrder: 4 }, confirmed: true }, result: { ...type, name: 'Plant room', isSystem: false } },
    { name: 'UteamupLocationNodeTypeUpdate', args: { typeGuid, model: { name: 'Bedroom', iconName: 'HomeModernIcon', displayOrder: 2 }, confirmed: true }, result: { ...type, name: 'Bedroom' } },
    { name: 'UteamupLocationNodeTree', args: { locationGuid, locationNodeTypeGuid: typeGuid }, result: [{ guid: nodeGuid, floorName: 'Bedroom', locationNodeTypeGuid: typeGuid, nodeTypeName: 'Room', parentLocationFloorGuid: locationGuid }] },
  ];
  const call = (name, args, reply) => callMcpTool(base, 'test-node-type-token', name, args, reply, args);
  beforeAll(() => nock.disableNetConnect());
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  afterAll(() => nock.enableNetConnect());

  for (const entry of cases) {
    test(`${entry.name} preserves GUIDs, fields and confirmation`, async () => {
      const response = await call(entry.name, entry.args, successReply(entry.result));
      expect(JSON.parse(response.body.result.content[0].text)).toEqual(entry.result);
      expect(entry.args).not.toHaveProperty('tenantId');
      expect(entry.args).not.toHaveProperty('userId');
      expect(nock.isDone()).toBe(true);
    });
    test(`${entry.name} preserves permission errors`, async () => {
      const response = await call(entry.name, entry.args, errorReply(-32602, 'Permission denied'));
      expect(response.body.error.message).toBe('Permission denied');
    });
  }
  test('empty catalog is an empty collection', async () => {
    const response = await call('UteamupLocationNodeTypeList', {}, successReply([]));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });
  describeJsonRpcCompliance(call, cases);
  describe401Unauthorized(base, cases);
  describe503ServiceUnavailable(base, cases);
});
