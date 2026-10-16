'use strict';
const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Location node original mutation tools', () => {
  const base = 'https://api.test.com';
  const guid = '11111111-1111-4111-8111-111111111111';
  const revision = '2026-10-16T12:00:00.1234567Z';
  const call = (name, args, reply) => callMcpTool(base, 'test-node-token', name, args, reply);
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  const tools = ['Create', 'Update', 'Move', 'Delete'].map(action => ({
    name: `UteamupLocationNode${action}`,
    args: { [action === 'Create' ? 'locationGuid' : 'nodeGuid']: guid, confirmed: true,
      model: { idempotencyKey: guid, mutationOutcomeVersion: 1,
        ...(action === 'Create' ? { floorName: 'Room', floorNumber: 0 } : { expectedUpdatedAt: revision }),
        ...(action === 'Update' ? { floorName: 'Updated', floorNumber: 1 } : {}),
        ...(action === 'Move' ? { newParentLocationFloorGuid: null } : {}),
      } },
  }));
  for (const tool of tools) {
    test(`${tool.name} preserves minimal receipt and unlink counts`, async () => {
      const receipt = { schemaVersion: 1, operationGuid: guid, nodeGuid: guid,
        action: tool.name.replace('UteamupLocationNode', '').toLowerCase(), outcome: 'applied',
        updatedAt: revision, unpinnedAssetCount: tool.name.endsWith('Delete') ? 2 : 0, unpinnedStockCount: 0 };
      const result = await call(tool.name, tool.args, successReply(receipt));
      expect(JSON.parse(result.body.result.content[0].text)).toEqual(receipt);
      expect(tool.args).not.toHaveProperty('tenantId');
      expect(tool.args).not.toHaveProperty('userId');
    });
    test(`${tool.name} preserves rejection instead of inventing an outcome`, async () => {
      const result = await call(tool.name, tool.args, errorReply(-32602, 'Reconciliation required'));
      expect(result.body.error.message).toBe('Reconciliation required');
    });
  }
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(base, tools);
  describe503ServiceUnavailable(base, tools);
});
