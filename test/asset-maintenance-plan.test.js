/**
 * GUID-only asset maintenance plan MCP proxy contract tests.
 *
 * The implementation lives backend-first as Command + Handler + Tool methods.
 * This suite verifies that the generic MCP proxy preserves the public GUID
 * arguments and the GUID-only response shape for plan and item operations.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool,
  successReply,
} = require('./helpers/mcp-test-helpers');
const {
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('asset maintenance plan MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_asset_maintenance_plan';
  const assetExternalGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const planExternalGuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const itemExternalGuid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const templateExternalGuid = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const workorderGuid = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

  const planModel = {
    name: 'Quarterly service',
    description: 'Inspect and service the asset',
    isActive: true,
  };

  const itemModel = {
    name: 'Inspect drive belt',
    triggerType: 0,
    calendarIntervalDays: 90,
    workorderTemplateExternalGuid: templateExternalGuid,
    isRequiredForWarranty: true,
    isRequiredForCertification: false,
  };

  const itemResponse = {
    externalGuid: itemExternalGuid,
    assetMaintenancePlanExternalGuid: planExternalGuid,
    ...itemModel,
    lastTriggeredAt: null,
    nextDueAt: '2026-10-15T08:00:00Z',
    lastWorkorderGuid: workorderGuid,
  };

  const planResponse = {
    externalGuid: planExternalGuid,
    assetExternalGuid,
    ...planModel,
    items: [itemResponse],
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  async function call(toolName, args, data) {
    const response = await callMcpTool(
      BASE_URL,
      ACCESS_TOKEN,
      toolName,
      args,
      successReply(data),
    );

    expect(response.status).toBe(200);
    return JSON.parse(response.body.result.content[0].text);
  }

  it.each([
    ['UteamupAssetMaintenancePlanList', { assetExternalGuid }, [planResponse]],
    ['UteamupAssetMaintenancePlanGet', { planExternalGuid }, planResponse],
    [
      'UteamupAssetMaintenancePlanCreate',
      { assetExternalGuid, model: planModel },
      planResponse,
    ],
    [
      'UteamupAssetMaintenancePlanUpdate',
      { planExternalGuid, model: planModel },
      planResponse,
    ],
    ['UteamupAssetMaintenancePlanDelete', { planExternalGuid }, true],
    ['UteamupAssetMaintenancePlanGetItems', { planExternalGuid }, [itemResponse]],
    [
      'UteamupAssetMaintenancePlanAddItem',
      { planExternalGuid, model: itemModel },
      itemResponse,
    ],
    [
      'UteamupAssetMaintenancePlanUpdateItem',
      { itemExternalGuid, model: itemModel },
      itemResponse,
    ],
    ['UteamupAssetMaintenancePlanDeleteItem', { itemExternalGuid }, true],
  ])('%s preserves its GUID contract', async (toolName, args, data) => {
    const result = await call(toolName, args, data);
    expect(result).toEqual(data);
    expect(JSON.stringify(result)).not.toMatch(
      /\"(?:id|assetId|assetMaintenancePlanId|workorderTemplateId|lastWorkorderId)\"/,
    );
  });

  const errorTools = [
    {
      name: 'UteamupAssetMaintenancePlanList',
      args: { assetExternalGuid },
    },
    {
      name: 'UteamupAssetMaintenancePlanGet',
      args: { planExternalGuid },
    },
    {
      name: 'UteamupAssetMaintenancePlanGetItems',
      args: { planExternalGuid },
    },
  ];

  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
