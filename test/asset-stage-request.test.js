'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Asset lifecycle stage requests', () => {
  const BASE_URL = 'https://api.test.com';
  const assetGuid = '55555555-5555-4555-8555-555555555555';
  const transitionGuid = '66666666-6666-4666-8666-666666666666';
  const args = {
    assetGuid,
    model: {
      toStage: 'decommissioned', expectedLifecycleVersion: 7,
      idempotencyKey: '77777777-7777-4777-8777-777777777777', notes: 'Taken out of service',
    },
  };
  const call = (name, input, reply) => callMcpTool(BASE_URL, 'test-token', name, input, reply, input);
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('preserves the pending approval receipt and exact reviewed decision', async () => {
    const response = await call('UteamupAssetStateRequestStage', args, successReply({
      transitionGuid, assetGuid, fromStage: 'operational', toStage: 'decommissioned',
      status: 'pending', versionNumber: 8, isInitialAssignment: false,
      requestedAt: '2026-11-02T05:00:00Z', notes: args.model.notes,
    }));
    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.status).toBe('pending');
    expect(result.transitionGuid).toBe(transitionGuid);
    expect(result.versionNumber).toBe(8);
    expect(result.notes).toBe(args.model.notes);
    expect(result).not.toHaveProperty('assetId');
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('assetUpdatedAt');
  });

  test('preserves an explicit first assignment with an omitted previous stage', async () => {
    const input = { ...args, model: { ...args.model, toStage: 'installed', expectedLifecycleVersion: 0 } };
    const response = await call('UteamupAssetStateRequestStage', input, successReply({
      transitionGuid, assetGuid, toStage: 'installed', status: 'approved', versionNumber: 1,
      isInitialAssignment: true, requestedAt: '2026-11-02T05:00:00Z', assetUpdatedAt: '2026-11-02T05:00:00Z',
    }));
    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.isInitialAssignment).toBe(true);
    expect(result).not.toHaveProperty('fromStage');
    expect(result.status).toBe('approved');
  });

  test.each([
    'Asset lifecycle changed from version 7 to 8. Refresh and retry.',
    'This asset already has a pending lifecycle transition.',
    'Asset not found.',
    'Permission denied: AssetLifecycle.Create required',
  ])('keeps the workflow refusal: %s', async (message) => {
    const response = await call('UteamupAssetStateRequestStage', args, errorReply(-32603, message));
    expect(response.body.error.message).toBe(message);
  });

  const tools = [{ name: 'UteamupAssetStateRequestStage', args }];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
