/**
 * Asset shutdown rule MCP tools test.
 *
 * Backend tools (AssetShutdownRuleTools): UteamupAssetShutdownRuleList (Asset.View),
 * UteamupAssetShutdownRuleCreate / Update / Delete (Asset.Update) and
 * UteamupWorkorderSetShutdownOverride (WorkOrder.Update). Mirrors api/assetshutdownrule and
 * PUT api/workorder/by-guid/{guid}/shutdown-override. Every identifier is a GUID.
 * Generic-proxy pattern (nock-mocked backend; no real network).
 */

'use strict';

const {
  callMcpTool: _callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const nock = require('nock');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Asset shutdown rule MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_asset_shutdown_rule';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  const assetGuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const ruleGuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const templateGuid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const workorderGuid = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  const rule = {
    guid: ruleGuid,
    assetGuid,
    assetName: 'P-101',
    workorderTemplateGuid: templateGuid,
    workorderTemplateName: 'Oil filter replacement',
    shutdownType: 2,
    instructions: 'Close valves V1 and V2.',
    isActive: true,
  };

  const toolError = (tool, text) => ({
    status: 200,
    body: {
      jsonrpc: '2.0',
      result: {
        content: [{ type: 'text', text: `An error occurred invoking '${tool}': ${text}` }],
        isError: true,
      },
      id: 1,
    },
  });

  describe('UteamupAssetShutdownRuleList', () => {
    it('returns the rules of the asset', async () => {
      const response = await call('UteamupAssetShutdownRuleList', { assetGuid }, successReply([rule]));

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(1);
      expect(data[0].guid).toBe(ruleGuid);
      expect(data[0].assetGuid).toBe(assetGuid);
      expect(data[0]).not.toHaveProperty('id');
      expect(data[0]).not.toHaveProperty('assetId');
    });

    it('returns an empty list when the asset has no rules', async () => {
      const response = await call('UteamupAssetShutdownRuleList', { assetGuid }, successReply([]));

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
    });

    it('surfaces an asset from another tenant as a not_found tool error', async () => {
      const response = await call(
        'UteamupAssetShutdownRuleList',
        { assetGuid },
        toolError('uteamup_asset_shutdown_rule_list', 'not_found: Asset not found.'),
      );

      expect(response.body.result.isError).toBe(true);
      expect(response.body.result.content[0].text).toContain('not_found: ');
    });
  });

  describe('UteamupAssetShutdownRuleCreate', () => {
    it('forwards the rule arguments verbatim', async () => {
      const args = {
        assetGuid,
        shutdownType: 'full',
        workorderTemplateGuid: templateGuid,
        maintenanceType: 'PreventiveScheduled',
        instructions: 'Close valves V1 and V2.',
        isActive: true,
      };

      const response = await call('UteamupAssetShutdownRuleCreate', args, successReply(rule), args);

      // nock only matches when params.arguments deep-equal `args`.
      expect(response.status).toBe(200);
      expect(JSON.parse(response.body.result.content[0].text).guid).toBe(ruleGuid);
    });

    it('surfaces a template from another tenant as an invalid_request tool error', async () => {
      const response = await call(
        'UteamupAssetShutdownRuleCreate',
        { assetGuid, shutdownType: 'full', workorderTemplateGuid: templateGuid },
        toolError('uteamup_asset_shutdown_rule_create', 'invalid_request: Workorder template not found.'),
      );

      expect(response.body.result.isError).toBe(true);
      expect(response.body.result.content[0].text).toContain('invalid_request: ');
    });

    it('surfaces a missing Asset.Update permission as a JSON-RPC error', async () => {
      const response = await call(
        'UteamupAssetShutdownRuleCreate',
        { assetGuid, shutdownType: 'partial' },
        errorReply(-32000, 'Permission denied: Asset.Update required'),
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/Asset\.Update/);
    });

    it('does NOT act on a spoofed userId/tenantId (identity comes from the Bearer token)', async () => {
      const response = await call(
        'UteamupAssetShutdownRuleCreate',
        { assetGuid, shutdownType: 'full', userId: 'spoofed-user', tenantId: 'spoofed-tenant' },
        successReply(rule),
      );

      expect(response.status).toBe(200);
    });
  });

  describe('UteamupAssetShutdownRuleUpdate', () => {
    it('forwards the replacement verbatim', async () => {
      const args = { ruleGuid, shutdownType: 'lockoutTagout', isActive: false };

      const response = await call(
        'UteamupAssetShutdownRuleUpdate',
        args,
        successReply({ ...rule, workorderTemplateGuid: null, shutdownType: 3, isActive: false }),
        args,
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.shutdownType).toBe(3);
      expect(data.isActive).toBe(false);
    });

    it('surfaces an unknown shutdown type as an invalid_request tool error', async () => {
      const response = await call(
        'UteamupAssetShutdownRuleUpdate',
        { ruleGuid, shutdownType: 'lockout_tagout' },
        toolError(
          'uteamup_asset_shutdown_rule_update',
          "invalid_request: Unknown shutdown type 'lockout_tagout'. Use none, partial, full or lockoutTagout.",
        ),
      );

      expect(response.body.result.isError).toBe(true);
    });
  });

  describe('UteamupAssetShutdownRuleDelete', () => {
    it('returns true when the rule is deleted', async () => {
      const response = await call('UteamupAssetShutdownRuleDelete', { ruleGuid }, successReply(true), { ruleGuid });

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body.result.content[0].text)).toBe(true);
    });
  });

  describe('UteamupWorkorderSetShutdownOverride', () => {
    it('returns the resolved requirement flagged as overridden', async () => {
      const args = { workorderGuid, shutdownType: 'partial', reason: 'Bypass line available' };
      const requirement = {
        requiredType: 1,
        isOverridden: true,
        overrideReason: 'Bypass line available',
        assets: [{ assetGuid, assetName: 'P-101', shutdownType: 2, instructions: 'Isolate.', ruleGuid }],
      };

      const response = await call('UteamupWorkorderSetShutdownOverride', args, successReply(requirement), args);

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.isOverridden).toBe(true);
      expect(data.assets[0].ruleGuid).toBe(ruleGuid);
    });

    it('clears the override when shutdownType is left out', async () => {
      const args = { workorderGuid };

      const response = await call(
        'UteamupWorkorderSetShutdownOverride',
        args,
        successReply({ requiredType: 2, isOverridden: false, assets: [] }),
        args,
      );

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body.result.content[0].text).isOverridden).toBe(false);
    });

    it('surfaces a missing WorkOrder.Update permission as a JSON-RPC error', async () => {
      const response = await call(
        'UteamupWorkorderSetShutdownOverride',
        { workorderGuid, shutdownType: 'none' },
        errorReply(-32000, 'Permission denied: WorkOrder.Update required'),
      );

      expect(response.body.error.message).toMatch(/WorkOrder\.Update/);
    });
  });

  const complianceTools = [
    { name: 'UteamupAssetShutdownRuleList', args: { assetGuid } },
    { name: 'UteamupAssetShutdownRuleCreate', args: { assetGuid, shutdownType: 'full' } },
    { name: 'UteamupAssetShutdownRuleUpdate', args: { ruleGuid, shutdownType: 'partial' } },
    { name: 'UteamupAssetShutdownRuleDelete', args: { ruleGuid } },
    { name: 'UteamupWorkorderSetShutdownOverride', args: { workorderGuid, shutdownType: 'none' } },
  ];

  describeJsonRpcCompliance(
    (name, args, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, name, args, mockReply),
    complianceTools,
  );
  describe401Unauthorized(BASE_URL, complianceTools);
  describe503ServiceUnavailable(BASE_URL, complianceTools);
});
