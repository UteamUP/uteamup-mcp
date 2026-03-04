/**
 * Extension System MCP tool tests
 *
 * Tests that Extension MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error
 * responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   UteamupExtensionList(filter?, category?, tier?)
 *   UteamupExtensionInstall(extensionId)
 *   UteamupExtensionUninstall(installationId)
 *   UteamupExtensionGetHealth(installationId)
 *   UteamupExtensionGetSandboxStatus()
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Extension System MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_extension';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------
  const extensionList = [
    {
      id: 1,
      extensionId: 'com.uteamup.customer-viewer',
      name: 'Customer Viewer',
      shortDescription: 'Browse and search customer data',
      tier: 0, // Official
      status: 3, // Published
      pricingModel: 0, // Free
      price: 0,
      averageRating: 4.5,
      installCount: 120
    },
    {
      id: 2,
      extensionId: 'com.example.reporting',
      name: 'Advanced Reporting',
      shortDescription: 'Generate detailed reports',
      tier: 1, // VerifiedPartner
      status: 3,
      pricingModel: 2, // Subscription
      price: 9.99,
      averageRating: 4.2,
      installCount: 45
    }
  ];

  const installResult = {
    id: 10,
    extensionId: 1,
    extensionName: 'Customer Viewer',
    tenantGuid: 'tenant-guid-123',
    status: 0, // Active
    installedAt: '2026-03-04T10:00:00Z',
    installedByUserId: 'user-123'
  };

  const healthStatus = {
    installationId: 10,
    extensionName: 'Customer Viewer',
    circuitBreakerState: 'Closed',
    isHealthy: true,
    failureCount: 0,
    averageResponseTimeMs: 42,
    lastSuccessAt: '2026-03-04T12:00:00Z',
    lastFailureAt: null
  };

  const sandboxStatus = {
    hasSandbox: true,
    isActive: true,
    sandboxTenantGuid: 'sandbox-guid-456',
    sandboxTenantName: 'My Company (Sandbox)',
    parentTenantGuid: 'tenant-guid-123',
    developerModeEnabledAt: '2026-03-01T08:00:00Z',
    lastDataRefresh: '2026-03-04T09:00:00Z',
    userCount: 3,
    extensionCount: 2
  };

  // ---------------------------------------------------------------------------
  // UteamupExtensionList
  // ---------------------------------------------------------------------------
  describe('UteamupExtensionList tool', () => {
    test('returns list of marketplace extensions', async () => {
      const response = await call(
        'UteamupExtensionList',
        {},
        successReply(extensionList)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      const extensions = JSON.parse(response.body.result.content[0].text);
      expect(extensions).toHaveLength(2);
      expect(extensions[0].name).toBe('Customer Viewer');
      expect(extensions[1].extensionId).toBe('com.example.reporting');
    });

    test('filters by category', async () => {
      const filtered = [extensionList[0]];
      const response = await call(
        'UteamupExtensionList',
        { category: 'Data & Reporting' },
        successReply(filtered)
      );

      expect(response.status).toBe(200);
      const extensions = JSON.parse(response.body.result.content[0].text);
      expect(extensions).toHaveLength(1);
      expect(extensions[0].name).toBe('Customer Viewer');
    });

    test('filters by tier', async () => {
      const filtered = [extensionList[1]];
      const response = await call(
        'UteamupExtensionList',
        { tier: 'VerifiedPartner' },
        successReply(filtered)
      );

      expect(response.status).toBe(200);
      const extensions = JSON.parse(response.body.result.content[0].text);
      expect(extensions).toHaveLength(1);
      expect(extensions[0].tier).toBe(1);
    });

    test('returns empty array when no extensions match', async () => {
      const response = await call(
        'UteamupExtensionList',
        { filter: 'nonexistent' },
        successReply([])
      );

      expect(response.status).toBe(200);
      const extensions = JSON.parse(response.body.result.content[0].text);
      expect(extensions).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupExtensionInstall
  // ---------------------------------------------------------------------------
  describe('UteamupExtensionInstall tool', () => {
    test('installs extension and returns installation details', async () => {
      const response = await call(
        'UteamupExtensionInstall',
        { extensionId: 1 },
        successReply(installResult)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      const installation = JSON.parse(response.body.result.content[0].text);
      expect(installation.extensionName).toBe('Customer Viewer');
      expect(installation.status).toBe(0);
      expect(installation.tenantGuid).toBe('tenant-guid-123');
    });

    test('returns error when extension not found', async () => {
      const response = await call(
        'UteamupExtensionInstall',
        { extensionId: 999 },
        errorReply(-32602, 'Extension not found')
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Extension not found');
    });

    test('returns error when extension already installed', async () => {
      const response = await call(
        'UteamupExtensionInstall',
        { extensionId: 1 },
        errorReply(-32602, 'Extension is already installed on this tenant')
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('already installed');
    });

    test('returns error when plan does not allow installation', async () => {
      const response = await call(
        'UteamupExtensionInstall',
        { extensionId: 2 },
        errorReply(-32602, 'Extension budget exceeded for current plan')
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('budget exceeded');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupExtensionUninstall
  // ---------------------------------------------------------------------------
  describe('UteamupExtensionUninstall tool', () => {
    test('uninstalls extension successfully', async () => {
      const response = await call(
        'UteamupExtensionUninstall',
        { installationId: 10 },
        successReply({ success: true, message: 'Extension uninstalled' })
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.success).toBe(true);
    });

    test('returns error when installation not found', async () => {
      const response = await call(
        'UteamupExtensionUninstall',
        { installationId: 999 },
        errorReply(-32602, 'Installation not found')
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Installation not found');
    });

    test('returns error when user lacks permission', async () => {
      const response = await call(
        'UteamupExtensionUninstall',
        { installationId: 10 },
        errorReply(-32603, 'Insufficient permissions to uninstall extensions')
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Insufficient permissions');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupExtensionGetHealth
  // ---------------------------------------------------------------------------
  describe('UteamupExtensionGetHealth tool', () => {
    test('returns health status for installed extension', async () => {
      const response = await call(
        'UteamupExtensionGetHealth',
        { installationId: 10 },
        successReply(healthStatus)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      const health = JSON.parse(response.body.result.content[0].text);
      expect(health.extensionName).toBe('Customer Viewer');
      expect(health.circuitBreakerState).toBe('Closed');
      expect(health.isHealthy).toBe(true);
      expect(health.failureCount).toBe(0);
      expect(health.averageResponseTimeMs).toBe(42);
    });

    test('returns degraded health status', async () => {
      const degradedHealth = {
        ...healthStatus,
        circuitBreakerState: 'HalfOpen',
        isHealthy: false,
        failureCount: 3,
        averageResponseTimeMs: 850,
        lastFailureAt: '2026-03-04T11:55:00Z'
      };

      const response = await call(
        'UteamupExtensionGetHealth',
        { installationId: 10 },
        successReply(degradedHealth)
      );

      expect(response.status).toBe(200);
      const health = JSON.parse(response.body.result.content[0].text);
      expect(health.circuitBreakerState).toBe('HalfOpen');
      expect(health.isHealthy).toBe(false);
      expect(health.failureCount).toBe(3);
    });

    test('returns error when installation not found', async () => {
      const response = await call(
        'UteamupExtensionGetHealth',
        { installationId: 999 },
        errorReply(-32602, 'Installation not found')
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Installation not found');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupExtensionGetSandboxStatus
  // ---------------------------------------------------------------------------
  describe('UteamupExtensionGetSandboxStatus tool', () => {
    test('returns sandbox status when developer mode is enabled', async () => {
      const response = await call(
        'UteamupExtensionGetSandboxStatus',
        {},
        successReply(sandboxStatus)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      const status = JSON.parse(response.body.result.content[0].text);
      expect(status.hasSandbox).toBe(true);
      expect(status.isActive).toBe(true);
      expect(status.sandboxTenantName).toBe('My Company (Sandbox)');
      expect(status.userCount).toBe(3);
      expect(status.extensionCount).toBe(2);
    });

    test('returns empty status when developer mode is not enabled', async () => {
      const noSandbox = {
        hasSandbox: false,
        isActive: false,
        sandboxTenantGuid: null,
        sandboxTenantName: null,
        parentTenantGuid: null,
        developerModeEnabledAt: null,
        lastDataRefresh: null,
        userCount: 0,
        extensionCount: 0
      };

      const response = await call(
        'UteamupExtensionGetSandboxStatus',
        {},
        successReply(noSandbox)
      );

      expect(response.status).toBe(200);
      const status = JSON.parse(response.body.result.content[0].text);
      expect(status.hasSandbox).toBe(false);
      expect(status.isActive).toBe(false);
      expect(status.sandboxTenantGuid).toBeNull();
    });

    test('returns error when user lacks developer permission', async () => {
      const response = await call(
        'UteamupExtensionGetSandboxStatus',
        {},
        errorReply(-32603, 'Developer.Read permission required')
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Developer.Read');
    });
  });

  // ---------------------------------------------------------------------------
  // JSON-RPC 2.0 compliance (all tools)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupExtensionList', args: {} },
    { name: 'UteamupExtensionInstall', args: { extensionId: 1 } },
    { name: 'UteamupExtensionUninstall', args: { installationId: 10 } },
    { name: 'UteamupExtensionGetHealth', args: { installationId: 10 } },
    { name: 'UteamupExtensionGetSandboxStatus', args: {} }
  ];

  describeJsonRpcCompliance(call, allTools);

  // ---------------------------------------------------------------------------
  // 401 Unauthorized (all tools)
  // ---------------------------------------------------------------------------
  describe401Unauthorized(BASE_URL, allTools);

  // ---------------------------------------------------------------------------
  // 503 Service Unavailable (all tools)
  // ---------------------------------------------------------------------------
  describe503ServiceUnavailable(BASE_URL, allTools);
});
