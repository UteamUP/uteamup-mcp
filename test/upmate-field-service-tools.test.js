/**
 * Governed UPMate field-service MCP proxy contracts.
 *
 * Commands, validation, tenant scope, permissions, feature gates, credits,
 * idempotency, and evidence are backend-owned. This suite proves the generic
 * proxy preserves only the reviewed GUID-first tool arguments and responses.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('governed UPMate field-service tools', () => {
  const baseUrl = 'https://api.test.com';
  const accessToken = 'test_access_token_upmate_field_service';
  const idempotencyKey = '11111111-1111-4111-8111-111111111111';
  const workorderGuid = '22222222-2222-4222-8222-222222222222';
  const technicianGuid = '33333333-3333-4333-8333-333333333333';
  const teamGuid = '44444444-4444-4444-8444-444444444444';
  const runGuid = '55555555-5555-4555-8555-555555555555';
  const planGuid = '66666666-6666-4666-8666-666666666666';
  const audioFileGuid = '77777777-7777-4777-8777-777777777777';
  const workRequestGuid = '88888888-8888-4888-8888-888888888888';
  const weekStartUtc = '2026-07-20T00:00:00Z';
  const asOfUtc = '2026-07-20T12:00:00Z';
  const evidence = [{
    entityType: 'tenantSource',
    entityGuid: workorderGuid,
    sourceVersion: '7',
    sourceUpdatedAtUtc: asOfUtc,
    evaluatedAtUtc: '2026-07-20T12:01:00Z',
    isStale: false,
    freshnessLabel: 'current',
    summary: 'Current tenant source evidence.',
  }];
  const tools = [
    {
      name: 'UteamupUpmateScheduleOptimizationPreview',
      capabilityKey: 'schedule.optimization.preview',
      args: {
        idempotencyKey,
        weekStartUtc,
        workorderGuids: [workorderGuid],
        technicianGuids: [technicianGuid],
        teamGuid,
        horizonDays: 14,
        competencyWeight: 2,
        travelWeight: 1.5,
        latenessWeight: 3,
        overtimeWeight: 2.5,
        workloadBalanceWeight: 1,
        continuityWeight: 4,
        repeatVisitWeight: 5,
        disruptionWeight: 6,
      },
      result: {
        run: { runGuid, status: 'Queued', progressPercent: 0 },
        requiresHumanReview: true,
        canApplyAutomatically: false,
      },
    },
    {
      name: 'UteamupUpmateScheduleOptimizationExplain',
      capabilityKey: 'schedule.optimization.explain',
      args: { runGuid },
      result: {
        runGuid,
        status: 'Completed',
        summary: 'Qualification constraints were evaluated.',
        constraintExplanations: ['Technician certification is required.'],
        requiresHumanReview: true,
        canApplyAutomatically: false,
      },
    },
    {
      name: 'UteamupUpmateMaintenancePlanSuggest',
      capabilityKey: 'maintenance.plan.suggest',
      args: {
        idempotencyKey,
        planGuids: [planGuid],
        asOfUtc,
        horizonDays: 30,
      },
      result: {
        run: { runGuid, status: 'PreviewReady', occurrenceCount: 1 },
        requiresHumanReview: true,
        canCreateWorkordersAutomatically: false,
      },
    },
    {
      name: 'UteamupUpmateMaintenanceDueExplain',
      capabilityKey: 'maintenance.due.explain',
      args: { planGuid, asOfUtc },
      result: {
        projection: { planExternalGuid: planGuid, items: [] },
        summary: 'No maintenance is currently due.',
        isDeterministic: true,
        canCreateWorkordersAutomatically: false,
      },
    },
    {
      name: 'UteamupUpmateFieldnoteTranscribe',
      capabilityKey: 'fieldnote.transcribe',
      args: { audioFileGuid },
      result: {
        audioFileGuid,
        status: 'Completed',
        transcript: 'Bearing vibration increased.',
        requiresHumanReview: true,
        audioInstructionsIgnored: true,
        canExecuteInstructions: false,
        creditsCharged: 0,
      },
    },
    {
      name: 'UteamupUpmatePortalRequestClassify',
      capabilityKey: 'portal.request.classify',
      args: { workRequestGuid, idempotencyKey, language: 'en' },
      result: {
        workRequestGuid,
        idempotencyKey,
        inputHash: 'sha256:reviewed',
        classification: {
          requiredSkills: ['Electrical'],
          requiredCertifications: ['High voltage'],
          complexity: 'High',
          estimatedDurationMinutes: 90,
          safetyHazards: ['Arc flash'],
          classificationReason: 'Qualified electrical review is required.',
          isSuccessful: true,
        },
        confidence: 0.81,
        expiresAtUtc: '2026-07-20T12:15:00Z',
        isStale: false,
        creditsCharged: 1,
        creditsRefunded: 0,
        remaining: 49,
        quotaBlockedReason: null,
        requiresHumanReview: true,
        canAutoDispatch: false,
        persistedToRequest: false,
      },
    },
    {
      name: 'UteamupUpmateServiceBillingReview',
      capabilityKey: 'service.billing.review',
      args: { runGuid },
      result: {
        billingRunGuid: runGuid,
        status: 'Draft',
        summary: 'One blocking exception requires review.',
        total: 1250.5,
        currency: 'EUR',
        exceptionCount: 1,
        blockingExceptionCount: 1,
        findings: ['Missing approved time'],
        requiresHumanReview: true,
        canChangeInvoices: false,
      },
    },
  ];
  // Free cost preview for the charged classify call. It is assistant-excluded
  // and returns a MarketplaceAiCostPreviewModel, so it carries no
  // capabilityKey/evidence envelope and takes no arguments; identity comes
  // from the Bearer token alone.
  const classifyCostTool = {
    name: 'UteamupUpmatePortalRequestClassifyCost',
    args: {},
  };
  const allTools = [...tools, classifyCostTool];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    callMcpTool(
      baseUrl,
      accessToken,
      toolName,
      toolArgs,
      mockReply,
      toolArgs,
    );

  test.each(tools)(
    '$name forwards exact bounded arguments and preserves its safe result',
    async ({ name, capabilityKey, args, result }) => {
      const response = await call(
        name,
        args,
        successReply({ capabilityKey, evidence, ...result }),
      );
      const data = JSON.parse(response.body.result.content[0].text);

      expect(response.status).toBe(200);
      expect(data.capabilityKey).toBe(capabilityKey);
      expect(data.evidence).toEqual(evidence);
      expect(args).not.toHaveProperty('tenantGuid');
      expect(args).not.toHaveProperty('userId');
      expect(args).not.toHaveProperty('apiKeyId');
      expect(args).not.toHaveProperty('executionActorGuid');
    },
  );

  test.each(tools)(
    '$name preserves an empty evidence result',
    async ({ name, capabilityKey, args, result }) => {
      const response = await call(
        name,
        args,
        successReply({ capabilityKey, evidence: [], ...result }),
      );
      const data = JSON.parse(response.body.result.content[0].text);

      expect(data.capabilityKey).toBe(capabilityKey);
      expect(data.evidence).toEqual([]);
    },
  );

  test.each(tools)(
    '$name preserves backend permission and validation failures',
    async ({ name, args }) => {
      const response = await call(
        name,
        args,
        errorReply(
          -32003,
          'Permission denied or the tenant feature is unavailable.',
        ),
      );

      expect(response.body.result).toBeUndefined();
      expect(response.body.error.code).toBe(-32003);
      expect(response.body.error.message).toMatch(/permission|feature/i);
    },
  );

  it('preserves a portal classification refund and quota receipt', async () => {
    const tool = tools.find(
      item => item.capabilityKey === 'portal.request.classify',
    );
    const response = await call(
      tool.name,
      tool.args,
      successReply({
        capabilityKey: tool.capabilityKey,
        workRequestGuid,
        idempotencyKey,
        inputHash: 'sha256:blocked',
        classification: {
          requiredSkills: [],
          requiredCertifications: [],
          complexity: 'Medium',
          estimatedDurationMinutes: 60,
          safetyHazards: [],
          classificationReason: 'Quota blocked before generation.',
          isSuccessful: false,
        },
        confidence: 0,
        expiresAtUtc: '2026-07-20T12:15:00Z',
        evidence,
        isStale: false,
        creditsCharged: 1,
        creditsRefunded: 1,
        remaining: 50,
        quotaBlockedReason: 'tenant_quota_exhausted',
        requiresHumanReview: true,
        canAutoDispatch: false,
        persistedToRequest: false,
      }),
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(data.creditsCharged).toBe(1);
    expect(data.creditsRefunded).toBe(1);
    expect(data.remaining).toBe(50);
    expect(data.quotaBlockedReason).toBe('tenant_quota_exhausted');
    expect(data.canAutoDispatch).toBe(false);
    expect(data.persistedToRequest).toBe(false);
  });

  it('previews the authoritative classification cost with no arguments', async () => {
    const response = await call(
      classifyCostTool.name,
      classifyCostTool.args,
      successReply({
        operationKey: 'portal.request.classify',
        expectedCredits: 1,
        remaining: 49,
        canRun: true,
      }),
    );
    const data = JSON.parse(response.body.result.content[0].text);

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      operationKey: 'portal.request.classify',
      expectedCredits: 1,
      remaining: 49,
      canRun: true,
    });
    // The bound call() forwards args as nock's expectedArgs, so this run
    // also proves the proxy sends exactly {} — no tenant/user injection.
    expect(classifyCostTool.args).toEqual({});
  });

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(baseUrl, allTools);
  describe503ServiceUnavailable(baseUrl, allTools);
});
