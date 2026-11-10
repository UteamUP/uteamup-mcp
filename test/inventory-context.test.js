'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Inventory context and explicit handling', () => {
  const base = 'https://api.uteamup.com';
  const guid = '11111111-1111-4111-8111-111111111111';
  const version = '22222222-2222-4222-8222-222222222222';
  const replacement = {
    type: 'asset', guid, requiresRespiratoryProtection: true, requiresHandProtection: false,
    requiresEyeProtection: true, requiresHearingProtection: false, requiresSpecialHandling: false,
    expectedVersionGuid: version,
  };
  const tools = [
    { name: 'UteamupInventoryContextSearch', args: { type: 'assetgroup', guid, kind: 'schedules', pageNumber: 2, pageSize: 25 } },
    { name: 'UteamupInventoryHandlingGet', args: { type: 'part', guid } },
    { name: 'UteamupInventoryHandlingUpdate', args: replacement },
    { name: 'ListInventory', args: { page: 1, pageSize: 20, includeContext: true, typeFilter: 'asset,assetgroup,part,tool,chemical' } },
    { name: 'UteamupInventoryContextGet', args: { type: 'asset', guid } },
  ];
  const call = (name, args, reply) => callMcpTool(base, 'fixture-token', name, args, reply, args);
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  it('preserves exact totals, bounded previews and native severity strings', async () => {
    const result = { sourceGuid: guid, sourceType: 'asset', sourceName: 'Pump', kind: 'alerts', relation: 'direct', totalItems: 4,
      currentPage: 1, pageSize: 1, totalPages: 4, items: [{ guid: version, name: 'Temperature', type: 'alert', severity: 'critical' }] };
    const response = await call(tools[0].name, { type: 'asset', guid, kind: 'alerts', severity: 'critical', pageSize: 1 }, successReply(result));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(result);
  });
  it('preserves unknown and reviewed-none as different values', async () => {
    for (const isConfigured of [false, true]) {
      const response = await call(tools[1].name, tools[1].args, successReply({ isConfigured, requiresHandProtection: false }));
      expect(JSON.parse(response.body.result.content[0].text).isConfigured).toBe(isConfigured);
    }
  });
  it('keeps an empty context page in its original source', async () => {
    const response = await call(tools[0].name, tools[0].args, successReply({ sourceGuid: guid, totalItems: 0, items: [] }));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual({ sourceGuid: guid, totalItems: 0, items: [] });
  });
  it('surfaces stale-version and denied-source failures', async () => {
    for (const message of ['InventoryHandlingVersionConflict', 'Permission denied']) {
      const response = await call(tools[2].name, replacement, errorReply(-32000, message));
      expect(response.body.error.message).toBe(message);
    }
  });
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(base, tools);
  describe503ServiceUnavailable(base, tools);
});
