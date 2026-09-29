'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Field Check MCP tools', () => {
  const baseUrl = 'https://api.test.com';
  const call = (name, args, reply) => callMcpTool(baseUrl, 'field-check-token', name, args, reply, args);
  const pointGuid = '11111111-1111-1111-1111-111111111111';
  const startGuid = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('returns a GUID-first checkpoint list and an empty list', async () => {
    const point = { externalGuid: pointGuid, name: 'Pond inlet', target: 'custom', fields: [] };
    const populated = await call('UteamupFieldcheckPointsList', {}, successReply([point]));
    expect(JSON.parse(populated.body.result.content[0].text)[0].externalGuid).toBe(pointGuid);
    const empty = await call('UteamupFieldcheckPointsList', {}, successReply([]));
    expect(JSON.parse(empty.body.result.content[0].text)).toEqual([]);
  });

  test('forwards an idempotent visit start model without actor or tenant arguments', async () => {
    const model = { clientStartGuid: startGuid, checkpointGuid: pointGuid, scanMethod: 'manual' };
    const response = await call('UteamupFieldcheckVisitStart', { model }, successReply({ externalGuid: startGuid }));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text).externalGuid).toBe(startGuid);
  });

  test('preserves backend JSON-RPC errors', async () => {
    const response = await call('UteamupFieldcheckPointsList', {}, errorReply(-32603, 'Permission denied'));
    expect(response.body.error.code).toBe(-32603);
  });

  const tools = [
    { name: 'UteamupFieldcheckPointsList', args: {} },
    { name: 'UteamupFieldcheckVisitStart', args: { model: { clientStartGuid: startGuid, checkpointGuid: pointGuid, scanMethod: 'manual' } } },
  ];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
