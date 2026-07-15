'use strict';

const nock = require('nock');
const { sendRawRequest, successReply } = require('./helpers/mcp-test-helpers');

describe('enabled UPMate capability contracts', () => {
  const BASE_URL = 'https://api.test.com';
  const GUID_A = '11111111-1111-4111-8111-111111111111';
  const GUID_B = '22222222-2222-4222-8222-222222222222';
  const GUID_C = '33333333-3333-4333-8333-333333333333';
  const START = '2026-07-15T08:00:00Z';
  const END = '2026-07-15T10:00:00Z';

  const capabilities = [
    { name: 'UteamupAssetList', args: { page: 1, pageSize: 10 } },
    { name: 'UteamupAssetGetByGuid', args: { guid: GUID_A } },
    { name: 'UteamupIoTMonitoringDashboard', args: {} },
    { name: 'UteamupIoTTelemetryPoints', args: { deviceGuid: GUID_A, limit: 25 } },
    { name: 'UteamupIoTRulesList', args: {} },
    { name: 'UteamupDocumentListVersionsByGuid', args: { externalGuid: GUID_A } },
    { name: 'UteamupDocumentGetMetadata', args: { guid: GUID_A } },
    { name: 'UteamupFleetDashboardGet', args: {} },
    { name: 'UteamupFleetDashboardGetCosts', args: { dateFrom: START, dateTo: END } },
    { name: 'UteamupMarketplaceBrowse', args: { search: 'bearing', page: 1, pageSize: 20 } },
    { name: 'UteamupMarketplaceRequirementsList', args: {} },
    {
      name: 'UteamupMarketplaceRequirementCreateDraft',
      args: { itemName: 'Bearing', itemType: 'Part', requestedQuantity: 4, audience: 'Both' },
    },
    { name: 'UteamupMarketplaceRequirementPublish', args: { requirementGuid: GUID_A } },
    { name: 'UteamupMarketplaceRequirementOffersCompare', args: { requirementGuid: GUID_A } },
    {
      name: 'UteamupMarketplaceRequirementOfferAccept',
      args: { requirementGuid: GUID_A, offerGuid: GUID_B },
    },
    { name: 'UteamupProjectList', args: { page: 1, pageSize: 10 } },
    { name: 'UteamupProjectGet', args: { projectGuid: GUID_A } },
    { name: 'UteamupProjectGetHealth', args: { projectGuid: GUID_A } },
    {
      name: 'UteamupScheduleAssignmentGetWorkorderOptions',
      args: { workorderGuid: GUID_A, plannedStartUtc: START, plannedEndUtc: END },
    },
    {
      name: 'UteamupScheduleAssignmentCreateByGuid',
      args: {
        workorderGuid: GUID_A,
        technicianGuid: GUID_B,
        plannedStartUtc: START,
        plannedEndUtc: END,
      },
    },
    { name: 'UteamupShiftList', args: {} },
    { name: 'UteamupShiftGetByGuid', args: { shiftGuid: GUID_A } },
    {
      name: 'UteamupStockCreateMarketplacePurchaseOrderDraft',
      args: { requirementGuid: GUID_A, offerGuid: GUID_B },
    },
    { name: 'UteamupStockGetTenantAlerts', args: { page: 1, pageSize: 50, stockGuid: GUID_A } },
    {
      name: 'UteamupStockSearchItems',
      args: { q: 'bearing', itemType: 'Part', stockGuid: GUID_A, page: 1, pageSize: 25 },
    },
    { name: 'UteamupStockListPurchaseOrders', args: { status: 'Submitted', page: 1, pageSize: 25 } },
    { name: 'UteamupStockGetPurchaseOrder', args: { guid: GUID_A } },
    { name: 'UteamupStockGetAtp', args: { itemGuid: GUID_A } },
    { name: 'UteamupStockSubmitPurchaseOrder', args: { guid: GUID_A } },
    { name: 'UteamupStockApprovePurchaseOrder', args: { guid: GUID_A } },
    {
      name: 'UteamupStockCreateReservation',
      args: { stockItemGuid: GUID_A, quantity: 2, workorderGuid: GUID_B },
    },
    { name: 'UteamupTutorialList', args: { platform: 'web' } },
    { name: 'UteamupTutorialGet', args: { tutorialId: 'workorders.create', platform: 'web' } },
    { name: 'UteamupVendorGetCatalog', args: { vendorGuid: GUID_A } },
    {
      name: 'UteamupWorkorderPrepareCloseoutByGuid',
      args: { workorderGuid: GUID_A, runGuid: GUID_B },
    },
    {
      name: 'UteamupWorkorderCompleteCloseoutByGuid',
      args: {
        workorderGuid: GUID_A,
        runGuid: GUID_B,
        executionReferenceGuid: GUID_C,
        expectedVersion: 'closeout-version',
      },
    },
    {
      name: 'UteamupWorkorderCreateByGuid',
      args: {
        title: 'Inspect pump',
        description: 'Inspect seals and vibration',
        startUtc: START,
        dueUtc: END,
        idempotencyKey: GUID_C,
        assetGuid: GUID_A,
        primaryAssigneeGuid: GUID_B,
      },
    },
    {
      name: 'UteamupWorkorderTemplateCreateFromTemplateByGuid',
      args: { templateGuid: GUID_A },
    },
    { name: 'UteamupWorkorderTemplateAnalyzePreview', args: { templateGuid: GUID_A } },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('matrix contains every currently enabled capability exactly once', () => {
    expect(capabilities).toHaveLength(39);
    expect(new Set(capabilities.map(capability => capability.name)).size).toBe(39);
  });

  test.each(capabilities)('$name forwards its exact GUID-safe JSON-RPC contract', async ({ name, args }) => {
    let captured;
    nock(BASE_URL)
      .post('/mcp', body => {
        captured = body;
        return true;
      })
      .reply(200, JSON.stringify(successReply({ accepted: true }).body), {
        'Content-Type': 'application/json',
      });

    const status = await sendRawRequest(BASE_URL, name, args, 700);

    expect(status).toBe(200);
    expect(captured).toEqual({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name, arguments: args },
      id: 700,
    });
    for (const [argumentName, value] of Object.entries(args)) {
      const isIdentifier = /(^id$|Id$|Ids$|_id$)/.test(argumentName);
      expect(isIdentifier && Number.isInteger(value)).toBe(false);
    }
  });
});
