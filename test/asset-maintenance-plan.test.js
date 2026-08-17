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
  const templateFamilyGuid = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const meterAttributeGuid = '12121212-1212-4121-8121-121212121212';

  const planModel = {
    name: 'Quarterly service',
    description: 'Inspect and service the asset',
    isActive: true,
    effectiveDate: '2026-07-01T00:00:00Z',
    consolidationWindowDays: 3,
    dueTriggerPolicy: 0,
    nestingPolicy: 0,
    schedulingHorizonDays: 14,
    cycleStartOffset: 0,
  };

  const itemModel = {
    name: 'Inspect drive belt',
    triggerType: 0,
    frequencyPreset: 3,
    calendarIntervalDays: 90,
    parentItemExternalGuid: null,
    sortOrder: 0,
    cycleMultiple: 1,
    meterIntervalValue: 100,
    meterAttributeDefinitionExternalGuid: meterAttributeGuid,
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

  const templateModel = {
    name: 'Pump service',
    consolidationWindowDays: 3,
    items: [itemModel],
  };

  const templateResponse = {
    externalGuid: templateExternalGuid,
    templateFamilyGuid,
    version: 2,
    isCurrent: true,
    createdAt: '2026-07-16T12:00:00Z',
    ...templateModel,
  };

  const dueProjection = {
    planExternalGuid,
    assetExternalGuid,
    calculatedAt: '2026-07-16T12:00:00Z',
    triggerPolicy: 0,
    items: [{
      planItemExternalGuid: itemExternalGuid,
      name: itemModel.name,
      state: 0,
      dueSource: 1,
      dueAt: '2026-07-26T12:00:00Z',
      reason: 'Projected from the observed meter rate.',
      currentMeterValue: 50,
      targetMeterValue: 100,
      calculatedRatePerDay: 5,
      meterSampleSize: 2,
      confidence: 'low',
    }],
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
      'UteamupAssetMaintenancePlanNestItem',
      {
        planExternalGuid,
        itemExternalGuid,
        model: { parentItemExternalGuid: itemExternalGuid },
      },
      itemResponse,
    ],
    [
      'UteamupAssetMaintenancePlanUpdateItem',
      { itemExternalGuid, model: itemModel },
      itemResponse,
    ],
    ['UteamupAssetMaintenancePlanDeleteItem', { itemExternalGuid }, true],
    [
      'UteamupAssetMaintenancePlanTemplateList',
      { includeHistory: true },
      [templateResponse],
    ],
    [
      'UteamupAssetMaintenancePlanTemplateGet',
      { templateExternalGuid },
      templateResponse,
    ],
    [
      'UteamupAssetMaintenancePlanTemplateCreate',
      { model: templateModel },
      templateResponse,
    ],
    [
      'UteamupAssetMaintenancePlanTemplateCreateVersion',
      { templateExternalGuid, model: templateModel },
      templateResponse,
    ],
    [
      'UteamupAssetMaintenancePlanDueProjection',
      { planExternalGuid, asOf: '2026-07-16T12:00:00Z' },
      dueProjection,
    ],
  ])('%s preserves its GUID contract', async (toolName, args, data) => {
    const result = await call(toolName, args, data);
    expect(result).toEqual(data);
    expect(JSON.stringify(result)).not.toMatch(
      /\"(?:id|assetId|assetMaintenancePlanId|templateId|meterAttributeId|workorderTemplateId|lastWorkorderId)\"/,
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
    {
      name: 'UteamupAssetMaintenancePlanTemplateList',
      args: { includeHistory: false },
    },
    {
      name: 'UteamupAssetMaintenancePlanDueProjection',
      args: { planExternalGuid },
    },
  ];

  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
