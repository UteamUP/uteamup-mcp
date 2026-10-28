'use strict';
const nock = require('nock');
const { callMcpTool, successReply } = require('./helpers/mcp-test-helpers');
const { describe401Unauthorized } = require('./helpers/mcp-error-tests');
const origin = 'https://api.uteamup.com';
const workorderGuid = '11111111-1111-4111-8111-111111111111';
const assetGuid = '22222222-2222-4222-8222-222222222222';
const snapshotGuid = '33333333-3333-4333-8333-333333333333';
const variants = [
  { name: 'UteamupWorkorderAssetSafetyGet', args: { workorderGuid } },
  { name: 'UteamupWorkorderAssetSafetyCapture', args: { workorderGuid } },
  { name: 'UteamupWorkorderAssetSafetyAcknowledge', args: { workorderGuid, assetGuid, snapshotGuid } },
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
});
