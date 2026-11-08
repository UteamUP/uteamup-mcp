'use strict';
const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');
const origin = 'https://api.uteamup.com';
const workorderGuid = '11111111-1111-4111-8111-111111111111';
const assetGuid = '22222222-2222-4222-8222-222222222222';
const snapshotGuid = '33333333-3333-4333-8333-333333333333';
const batch = { name: 'UteamupWorkorderAssetSafetyAcknowledgeBatch', args: { workorderGuid, items: [{ assetGuid, snapshotGuid }] } };
const variants = [
  { name: 'UteamupWorkorderAssetSafetyGet', args: { workorderGuid } },
  { name: 'UteamupWorkorderAssetSafetyCapture', args: { workorderGuid } },
  { name: 'UteamupWorkorderAssetSafetyAcknowledge', args: { workorderGuid, assetGuid, snapshotGuid } },
  batch,
];

describe('Named human equipment safety adapters', () => {
  beforeAll(() => nock.disableNetConnect());
  afterAll(() => nock.enableNetConnect());
  afterEach(() => nock.cleanAll());
  test.each(variants)('forwards only the exact requested operation: $name', async ({ name, args }) => {
    const result = { items: [{ assetGuid, snapshotGuid, instructions: 'Isolate energy before work', missingDefinition: false }],
      requiresCapture: false, requiresAcknowledgement: true };
    const response = await callMcpTool(origin, 'named-user-token', name, args, successReply(result), args);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(result);
    expect(nock.isDone()).toBe(true);
  });
  describe401Unauthorized(origin, variants);
  describe503ServiceUnavailable(origin, [batch]);
  describeJsonRpcCompliance((name, args, reply) =>
    callMcpTool(origin, 'named-user-token', name, args, reply, args), [batch]);
  test('batch forwards an empty current safety response without inventing acknowledgements', async () => {
    const result = { items: [], requiresCapture: false, requiresAcknowledgement: false };
    const response = await callMcpTool(origin, 'named-user-token', batch.name, batch.args, successReply(result), batch.args);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(result);
  });
  test('batch preserves a stale-snapshot refusal', async () => {
    const response = await callMcpTool(origin, 'named-user-token', batch.name, batch.args,
      errorReply(-32602, 'asset_safety_changed'), batch.args);
    expect(response.body.error).toEqual({ code: -32602, message: 'asset_safety_changed' });
    expect(response.body.result).toBeUndefined();
  });
});
