/**
 * UPMate Field Service MCP tool tests
 *
 * The seven governed field-service capabilities plus the authoritative
 * cost-preview helper for the single charged capability:
 *   UteamupUpmateScheduleOptimizationPreview(idempotencyKey, weekStartUtc, workorderGuids, technicianGuids, ...)
 *   UteamupUpmateScheduleOptimizationExplain(runGuid)
 *   UteamupUpmateMaintenancePlanSuggest(idempotencyKey, planGuids, horizonDays, ...)
 *   UteamupUpmateMaintenanceDueExplain(planGuid, asOfUtc)
 *   UteamupUpmateFieldnoteTranscribe(audioFileGuid)
 *   UteamupUpmatePortalRequestClassifyCost()            <- free, call BEFORE the charged classify
 *   UteamupUpmatePortalRequestClassify(workRequestGuid, idempotencyKey, language)
 *   UteamupUpmateServiceBillingReview(runGuid)
 *
 * Pattern mirrors labour-rate.test.js: raw nock-mocked HTTPS calls simulating
 * what the MCP proxy forwards to the backend /mcp endpoint.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('UPMate Field Service MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_upmate_fs';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  // ---------------------------------------------------------------------------
  // Shared GUIDs and canonical tool argument sets (all public identifiers are GUIDs)
  // ---------------------------------------------------------------------------
  const RUN_GUID = '10000000-0000-4000-8000-000000000001';
  const PLAN_GUID = '20000000-0000-4000-8000-000000000002';
  const AUDIO_GUID = '30000000-0000-4000-8000-000000000003';
  const REQUEST_GUID = '40000000-0000-4000-8000-000000000004';
  const IDEMPOTENCY_KEY = '50000000-0000-4000-8000-000000000005';

  const TOOLS = [
    {
      name: 'UteamupUpmateScheduleOptimizationPreview',
      args: {
        idempotencyKey: IDEMPOTENCY_KEY,
        weekStartUtc: '2026-07-20T00:00:00Z',
        workorderGuids: ['60000000-0000-4000-8000-000000000006'],
        technicianGuids: ['70000000-0000-4000-8000-000000000007'],
        horizonDays: 7
      }
    },
    { name: 'UteamupUpmateScheduleOptimizationExplain', args: { runGuid: RUN_GUID } },
    {
      name: 'UteamupUpmateMaintenancePlanSuggest',
      args: { idempotencyKey: IDEMPOTENCY_KEY, planGuids: [PLAN_GUID], horizonDays: 30 }
    },
    {
      name: 'UteamupUpmateMaintenanceDueExplain',
      args: { planGuid: PLAN_GUID, asOfUtc: '2026-07-21T00:00:00Z' }
    },
    { name: 'UteamupUpmateFieldnoteTranscribe', args: { audioFileGuid: AUDIO_GUID } },
    { name: 'UteamupUpmatePortalRequestClassifyCost', args: {} },
    {
      name: 'UteamupUpmatePortalRequestClassify',
      args: { workRequestGuid: REQUEST_GUID, idempotencyKey: IDEMPOTENCY_KEY, language: 'en' }
    },
    { name: 'UteamupUpmateServiceBillingReview', args: { runGuid: RUN_GUID } }
  ];

  // ---------------------------------------------------------------------------
  // Success shapes per tool
  // ---------------------------------------------------------------------------
  describe('successful calls', () => {
    test('schedule preview returns a review-only run without applying', async () => {
      const payload = {
        run: { runGuid: RUN_GUID, status: 'Queued', progressPercent: 0 },
        requiresHumanReview: true,
        canApplyAutomatically: false
      };
      const response = await call(TOOLS[0].name, TOOLS[0].args, successReply(payload), TOOLS[0].args);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.run.runGuid).toBe(RUN_GUID);
      expect(data.canApplyAutomatically).toBe(false);
      expect(data.requiresHumanReview).toBe(true);
    });

    test('cost preview returns authoritative credits without any arguments', async () => {
      const payload = {
        operationKey: 'portal.request.classify',
        expectedCredits: 1,
        remaining: 41,
        canRun: true
      };
      const response = await call(
        'UteamupUpmatePortalRequestClassifyCost', {}, successReply(payload), {});
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.operationKey).toBe('portal.request.classify');
      expect(data.expectedCredits).toBe(1);
      expect(data.remaining).toBe(41);
      expect(data.canRun).toBe(true);
    });

    test('charged classify round-trips GUID-only args and never auto-dispatches', async () => {
      const payload = {
        workRequestGuid: REQUEST_GUID,
        idempotencyKey: IDEMPOTENCY_KEY,
        classification: { complexity: 'Medium', isSuccessful: true },
        creditsCharged: 1,
        remaining: 40,
        canAutoDispatch: false,
        persistedToRequest: false
      };
      const args = TOOLS[6].args;
      const response = await call(TOOLS[6].name, args, successReply(payload), args);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.workRequestGuid).toBe(REQUEST_GUID);
      expect(data.canAutoDispatch).toBe(false);
      expect(data.persistedToRequest).toBe(false);
    });

    test('quota-blocked classify surfaces a governed outcome, not a charge', async () => {
      const payload = {
        workRequestGuid: REQUEST_GUID,
        creditsCharged: 0,
        creditsRefunded: 0,
        remaining: 0,
        quotaBlockedReason: 'QuotaExceeded',
        canAutoDispatch: false
      };
      const response = await call(TOOLS[6].name, TOOLS[6].args, successReply(payload));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.creditsCharged).toBe(0);
      expect(data.quotaBlockedReason).toBe('QuotaExceeded');
    });

    test('transcribe returns the stored transcript with zero charge', async () => {
      const payload = {
        audioFileGuid: AUDIO_GUID,
        status: 'Completed',
        transcript: 'Pump vibration increased.',
        creditsCharged: 0,
        audioInstructionsIgnored: true,
        canExecuteInstructions: false
      };
      const response = await call(TOOLS[4].name, TOOLS[4].args, successReply(payload), TOOLS[4].args);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.creditsCharged).toBe(0);
      expect(data.canExecuteInstructions).toBe(false);
    });

    test('billing review reports evidence without changing invoices', async () => {
      const payload = {
        billingRunGuid: RUN_GUID,
        status: 'Review',
        exceptionCount: 2,
        blockingExceptionCount: 1,
        findings: ['SLA-01: Missing coverage window'],
        canChangeInvoices: false
      };
      const response = await call(TOOLS[7].name, TOOLS[7].args, successReply(payload), TOOLS[7].args);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.canChangeInvoices).toBe(false);
      expect(data.findings).toHaveLength(1);
    });

    test('maintenance due explanation stays deterministic and read-only', async () => {
      const payload = {
        projection: { planExternalGuid: PLAN_GUID, items: [] },
        isDeterministic: true,
        canCreateWorkordersAutomatically: false
      };
      const response = await call(TOOLS[3].name, TOOLS[3].args, successReply(payload), TOOLS[3].args);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.isDeterministic).toBe(true);
      expect(data.canCreateWorkordersAutomatically).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Cost-preview-before-charge flow (the disclosed contract)
  // ---------------------------------------------------------------------------
  describe('cost disclosure before charged classification', () => {
    test('the free cost preview and the charged classify are separate calls in order', async () => {
      const cost = await call(
        'UteamupUpmatePortalRequestClassifyCost',
        {},
        successReply({ operationKey: 'portal.request.classify', expectedCredits: 1, remaining: 41, canRun: true }),
        {});
      const costData = JSON.parse(cost.body.result.content[0].text);
      expect(costData.canRun).toBe(true);

      const classify = await call(
        'UteamupUpmatePortalRequestClassify',
        TOOLS[6].args,
        successReply({ workRequestGuid: REQUEST_GUID, creditsCharged: costData.expectedCredits, remaining: 40 }));
      const classifyData = JSON.parse(classify.body.result.content[0].text);
      expect(classifyData.creditsCharged).toBe(costData.expectedCredits);
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------
  describe('backend error responses', () => {
    test('feature-disabled denial propagates as a JSON-RPC error', async () => {
      const response = await call(
        TOOLS[6].name,
        TOOLS[6].args,
        errorReply(-32603, 'Feature not enabled: UPMate Field Service Preview access is required.'));
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('UPMate Field Service');
      expect(response.body.result).toBeUndefined();
    });

    test('permission denial on the cost preview propagates as a JSON-RPC error', async () => {
      const response = await call(
        'UteamupUpmatePortalRequestClassifyCost',
        {},
        errorReply(-32603, 'Permission denied: CustomerPortal.Read required.'));
      expect(response.body.error.message).toContain('CustomerPortal.Read');
    });
  });

  // ---------------------------------------------------------------------------
  // Actor-neutral argument guard: no caller may smuggle identity or tenant ids
  // ---------------------------------------------------------------------------
  describe('argument regression guards', () => {
    test.each(TOOLS)('$name arguments carry no userId/tenantId/actor keys', ({ args }) => {
      const forbidden = ['userid', 'userguid', 'tenantid', 'tenantguid', 'actor', 'apikey'];
      for (const key of Object.keys(args)) {
        const normalized = key.toLowerCase();
        for (const banned of forbidden) {
          expect(normalized.includes(banned)).toBe(false);
        }
      }
    });

    test('every public identifier argument is a GUID', () => {
      for (const tool of TOOLS) {
        for (const [key, value] of Object.entries(tool.args)) {
          if (!key.endsWith('Guid') && key !== 'idempotencyKey') continue;
          const values = Array.isArray(value) ? value : [value];
          for (const candidate of values) {
            expect(candidate).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
          }
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Required shared compliance suites
  // ---------------------------------------------------------------------------
  describeJsonRpcCompliance(call, TOOLS);
  describe401Unauthorized(BASE_URL, TOOLS);
  describe503ServiceUnavailable(BASE_URL, TOOLS);
});
