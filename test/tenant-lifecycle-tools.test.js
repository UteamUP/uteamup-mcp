/**
 * Tenant billing lifecycle MCP tool tests (Superpowers change tenant-billing-lifecycle).
 *
 * Tools under test (backend UteamUP_API/MCP/Tools/TenantLifecycleTools.cs):
 *   TenantLifecycleGet()                                   current tenant, any member
 *   AdminGetTenantLifecycle(tenantGuid)                     configured Global Admin only
 *   AdminUnarchiveTenant(tenantGuid, extendDays?)           configured Global Admin only
 *   AdminPostponeTenantDeletion(tenantGuid, deletionDueAt)  configured Global Admin only
 *   AdminSetTenantLegalHold(tenantGuid, hold, reason?)      configured Global Admin only
 *   AdminSetTenantAlwaysFreeDemoWorkspace(tenantGuid, enabled, reason)  configured Global Admin only
 *   AdminGetTenantLifecycleSettings()                       configured Global Admin only
 *   AdminUpdateTenantLifecycleSettings(mode?, …periods?)    configured Global Admin only
 *
 * Raw nock-mocked HTTPS calls simulate what the generic proxy forwards to the backend /mcp.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Tenant billing lifecycle MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_tenant_lifecycle';
  const TENANT_GUID = '6f1d2c3b-4a5e-4f60-9a1b-2c3d4e5f6a7b';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const archived = {
    tenantGuid: TENANT_GUID,
    tenantName: 'Unpaid Workspace',
    stage: 'archived',
    archivedAt: '2027-03-01T09:00:00Z',
    deletionDueAt: '2027-05-30T00:00:00Z',
    legalHold: false,
    isOwner: true,
    canRestore: true,
    canExport: true
  };

  describe('Happy path', () => {
    test('TenantLifecycleGet — returns the stage and dates of the current tenant', async () => {
      const response = await call('TenantLifecycleGet', {}, successReply(archived));
      expect(response.status).toBe(200);
      const payload = JSON.parse(response.body.result.content[0].text);
      expect(payload.stage).toBe('archived');
      expect(payload.canRestore).toBe(true);
    });

    test('AdminUnarchiveTenant — forwards the extension and returns the new stage', async () => {
      const reply = successReply({ ok: true, outcome: 'Ok', errorCode: null, value: { ...archived, stage: 'awaitingFirstPayment', archivedAt: null } });
      const response = await call('AdminUnarchiveTenant', { tenantGuid: TENANT_GUID, extendDays: 30 }, reply);
      expect(response.status).toBe(200);
      expect(JSON.parse(response.body.result.content[0].text).value.stage).toBe('awaitingFirstPayment');
    });

    test('AdminSetTenantLegalHold — places a hold with a reason', async () => {
      const reply = successReply({ ok: true, outcome: 'Ok', errorCode: null, value: { ...archived, legalHold: true } });
      const response = await call('AdminSetTenantLegalHold', { tenantGuid: TENANT_GUID, hold: true, reason: 'Court order' }, reply);
      expect(JSON.parse(response.body.result.content[0].text).value.legalHold).toBe(true);
    });

    test('AdminSetTenantAlwaysFreeDemoWorkspace — makes the workspace permanently free and active', async () => {
      const reply = successReply({ ok: true, outcome: 'Ok', errorCode: null, value: { ...archived, stage: 'active', archivedAt: null, alwaysFreeDemoWorkspace: true } });
      const response = await call('AdminSetTenantAlwaysFreeDemoWorkspace', { tenantGuid: TENANT_GUID, enabled: true, reason: 'Partner demo' }, reply);
      const payload = JSON.parse(response.body.result.content[0].text);
      expect(payload.ok).toBe(true);
      expect(payload.value.alwaysFreeDemoWorkspace).toBe(true);
      expect(payload.value.stage).toBe('active');
    });
  });

  describe('Settings', () => {
    const settings = {
      mode: 'enforce',
      effectiveMode: 'dryRun',
      purchasesAvailable: false,
      enforcedSince: null,
      cardGraceDays: 15,
      archiveAfterDays: 90,
      deleteAfterArchiveDays: 90,
      restoreWindowDays: 30,
      finalExportRetentionDays: 30,
      maxTransitionsPerRun: 25,
      contactEmail: 'privacy@uteamup.com',
      deprovisionDedicatedResources: false
    };

    test('AdminGetTenantLifecycleSettings — Enforce runs as a dry run while purchases are closed', async () => {
      const response = await call('AdminGetTenantLifecycleSettings', {}, successReply(settings));
      const payload = JSON.parse(response.body.result.content[0].text);
      expect(payload.mode).toBe('enforce');
      expect(payload.effectiveMode).toBe('dryRun');
    });

    test('AdminUpdateTenantLifecycleSettings — a partial update returns the merged settings', async () => {
      const reply = successReply({ ok: true, outcome: 'Ok', errorCode: null, value: { ...settings, mode: 'dryRun', cardGraceDays: 20 } });
      const response = await call('AdminUpdateTenantLifecycleSettings', { mode: 'DryRun', cardGraceDays: 20 }, reply);
      const payload = JSON.parse(response.body.result.content[0].text);
      expect(payload.ok).toBe(true);
      expect(payload.value.cardGraceDays).toBe(20);
      expect(payload.value.archiveAfterDays).toBe(90);
    });

    test('AdminUpdateTenantLifecycleSettings — an out-of-range period is refused with a code', async () => {
      const reply = successReply({ ok: false, outcome: 'Invalid', errorCode: 'out_of_range', value: null });
      const response = await call('AdminUpdateTenantLifecycleSettings', { archiveAfterDays: 10 }, reply);
      expect(JSON.parse(response.body.result.content[0].text).errorCode).toBe('out_of_range');
    });

    test('AdminUpdateTenantLifecycleSettings — a non-Global-Admin caller is refused', async () => {
      const response = await call('AdminUpdateTenantLifecycleSettings', { mode: 'Enforce' }, errorReply(-32001, 'Caller is not a configured globaladmin.'));
      expect(response.body.error.message).toBe('Caller is not a configured globaladmin.');
    });
  });

  describe('Refusals', () => {
    test('a non-Global-Admin caller gets the backend authorization error', async () => {
      const response = await call('AdminUnarchiveTenant', { tenantGuid: TENANT_GUID }, errorReply(-32001, 'Caller is not a configured globaladmin.'));
      expect(response.body.error.message).toBe('Caller is not a configured globaladmin.');
    });

    test('an out-of-range postponement comes back as a typed error code', async () => {
      const reply = successReply({ ok: false, outcome: 'Invalid', errorCode: 'deletion_date_out_of_range', value: null });
      const response = await call('AdminPostponeTenantDeletion', { tenantGuid: TENANT_GUID, deletionDueAt: '2030-01-01' }, reply);
      const payload = JSON.parse(response.body.result.content[0].text);
      expect(payload.ok).toBe(false);
      expect(payload.errorCode).toBe('deletion_date_out_of_range');
    });

    test('a legal hold without a reason is refused', async () => {
      const reply = successReply({ ok: false, outcome: 'Invalid', errorCode: 'legal_hold_reason_required', value: null });
      const response = await call('AdminSetTenantLegalHold', { tenantGuid: TENANT_GUID, hold: true }, reply);
      expect(JSON.parse(response.body.result.content[0].text).errorCode).toBe('legal_hold_reason_required');
    });

    test('a free demo workspace is refused while an unpaid invoice is open', async () => {
      const reply = successReply({ ok: false, outcome: 'Conflict', errorCode: 'demo_workspace_has_unpaid_invoice', value: null });
      const response = await call('AdminSetTenantAlwaysFreeDemoWorkspace', { tenantGuid: TENANT_GUID, enabled: true, reason: 'Partner demo' }, reply);
      const payload = JSON.parse(response.body.result.content[0].text);
      expect(payload.ok).toBe(false);
      expect(payload.errorCode).toBe('demo_workspace_has_unpaid_invoice');
    });

    test('a free demo workspace change by a non-Global-Admin caller is refused', async () => {
      const response = await call('AdminSetTenantAlwaysFreeDemoWorkspace', { tenantGuid: TENANT_GUID, enabled: true, reason: 'x' }, errorReply(-32001, 'Caller is not a configured globaladmin.'));
      expect(response.body.error.message).toBe('Caller is not a configured globaladmin.');
    });
  });

  const complianceTools = [
    { name: 'TenantLifecycleGet', args: {} },
    { name: 'AdminGetTenantLifecycle', args: { tenantGuid: TENANT_GUID } },
    { name: 'AdminUnarchiveTenant', args: { tenantGuid: TENANT_GUID, extendDays: 30 } },
    { name: 'AdminPostponeTenantDeletion', args: { tenantGuid: TENANT_GUID, deletionDueAt: '2027-06-30' } },
    { name: 'AdminSetTenantLegalHold', args: { tenantGuid: TENANT_GUID, hold: false } },
    { name: 'AdminSetTenantAlwaysFreeDemoWorkspace', args: { tenantGuid: TENANT_GUID, enabled: false, reason: 'Demo ended' } },
    { name: 'AdminGetTenantLifecycleSettings', args: {} },
    { name: 'AdminUpdateTenantLifecycleSettings', args: { mode: 'DryRun' } }
  ];

  describeJsonRpcCompliance(call, complianceTools);
  describe401Unauthorized(BASE_URL, complianceTools);
  describe503ServiceUnavailable(BASE_URL, complianceTools);
});
