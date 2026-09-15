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
    { name: 'UteamupITManagementDashboard', args: {} },
    { name: 'UteamupITManagementAlertsList', args: { state: 'open', pageSize: 10 } },
    { name: 'UteamupITManagementAlertGet', args: { alertGuid: GUID_A } },
    { name: 'UteamupITManagementAlertAcknowledge', args: { alertGuid: GUID_A, reasonCode: 'expected' } },
    { name: 'UteamupITManagementAlertResolve', args: { alertGuid: GUID_A, reasonCode: 'fixed' } },
    { name: 'UteamupITManagementRulesList', args: {} },
    { name: 'UteamupITManagementConnectionsList', args: {} },
    { name: 'UteamupITManagementResourcesList', args: { unmappedOnly: true, page: 1, pageSize: 25 } },
    { name: 'UteamupITManagementServiceMapSummary', args: { windowHours: 24 } },
    { name: 'UteamupITManagementFlowsSummary', args: { sourceAssetGuid: GUID_A, window: '24h' } },
    { name: 'UteamupITManagementActivityLog', args: { failedOnly: true, subscriptionId: GUID_B, limit: 50 } },
    { name: 'UteamupDocumentListVersionsByGuid', args: { externalGuid: GUID_A } },
    { name: 'UteamupDocumentGetMetadata', args: { guid: GUID_A } },
    { name: 'UteamupFleetDashboardGet', args: {} },
    { name: 'UteamupFleetDashboardGetCosts', args: { dateFrom: START, dateTo: END } },
    {
      name: 'UteamupFleetIntelligenceGetAnomalies',
      args: { lookbackDays: 60, minimumHistory: 8 },
    },
    { name: 'UteamupFleetIntelligenceGetTireReadiness', args: { assetGuid: GUID_A } },
    {
      name: 'UteamupFleetIntelligenceGetReplacementTco',
      args: {
        assetGuid: GUID_A,
        currency: 'EUR',
        horizonMonths: 36,
        replacementEstimate: 42000,
        residualValue: 8000,
        financingCost: 1800,
        downtimeCostPerHour: 125,
        replacementAnnualMaintenanceCost: 900,
        replacementFuelReductionPercent: 12,
      },
    },
    {
      name: 'UteamupFleetMaintenancePropose',
      args: {
        sourceType: 'asset-maintenance-package',
        sourceGuid: GUID_A,
        idempotencyKey: 'fleet-package-contract-1',
      },
    },
    { name: 'UteamupMarketplaceBrowse', args: { search: 'bearing', page: 1, pageSize: 20 } },
    { name: 'UteamupMarketplaceRequirementsList', args: {} },
    {
      name: 'UteamupMarketplaceRequirementCreateDraft',
      args: { itemName: 'Bearing', itemType: 'Part', requestedQuantity: 4, audience: 'Both' },
    },
    { name: 'UteamupMarketplaceRequirementPublish', args: { requirementGuid: GUID_A, draftVersion: 'A'.repeat(64) } },
    { name: 'UteamupMarketplaceRequirementOffersCompare', args: { requirementGuid: GUID_A } },
    {
      name: 'UteamupMarketplaceRequirementOfferAccept',
      args: { requirementGuid: GUID_A, offerGuid: GUID_B },
    },
    { name: 'UteamupProjectList', args: { page: 1, pageSize: 10 } },
    { name: 'UteamupProjectGet', args: { projectGuid: GUID_A } },
    { name: 'UteamupProjectGetHealth', args: { projectGuid: GUID_A } },
    { name: 'UteamupProjectBudgetGet', args: { projectGuid: GUID_A } },
    {
      name: 'UteamupReliabilityRiskGet',
      args: { assetGuid: GUID_A, fromUtc: START, toUtc: END, limit: 20 },
    },
    {
      name: 'UteamupReliabilityStrategyPropose',
      args: { assetGuid: GUID_A, objectiveKey: 'availability', fromUtc: START, toUtc: END },
    },
    {
      name: 'UteamupReliabilityAssessmentsList',
      args: { assetGuid: GUID_A, includeHistory: false },
    },
    {
      name: 'UteamupReliabilityAssessmentCreate',
      args: {
        requestGuid: GUID_C,
        assetGuid: GUID_A,
        failureModeKey: 'bearing-fatigue',
        failureModeName: 'Bearing fatigue',
        severityScore: 8,
        detectabilityScore: 6,
        evidenceReferenceGuids: [GUID_B],
      },
    },
    {
      name: 'UteamupReliabilityAssessmentApprove',
      args: { versionGuid: GUID_A, requestGuid: GUID_C, expectedVersion: 1 },
    },
    {
      name: 'UteamupReliabilityStrategyPrepareRun',
      args: {
        requestGuid: GUID_B,
        runRequestGuid: GUID_C,
        assetGuid: GUID_A,
        objectiveKey: 'availability',
      },
    },
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
      name: 'UteamupWorkorderCreate',
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
    expect(capabilities).toHaveLength(51);
    expect(new Set(capabilities.map(capability => capability.name)).size).toBe(capabilities.length);
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
