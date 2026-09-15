'use strict';

const nock = require('nock');
const { callMcpTool: callTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('IT Management MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_itmanagement';
  const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const ALERT_GUID = '11111111-1111-4111-8111-111111111111';
  const ASSET_GUID = '22222222-2222-4222-8222-222222222222';
  const call = (name, args, reply) => callTool(BASE_URL, ACCESS_TOKEN, name, args, reply);
  const parse = (response) => JSON.parse(response.body.result.content[0].text);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('dashboard carries connection health and severity counts without integer ids', async () => {
    const response = await call('UteamupITManagementDashboard', {}, successReply({
      hasConnection: true,
      connectionGuid: ALERT_GUID,
      connectionStatus: 'active',
      syncInProgress: false,
      openAlerts: { info: 1, warning: 2, error: 3, critical: 4, total: 10 },
      serversTotal: 12,
      serversOffline: 1,
      stormActive: false,
      unmappedResources: 6,
    }));
    const dashboard = parse(response);
    expect(dashboard.connectionGuid).toMatch(GUID);
    expect(dashboard.openAlerts.total).toBe(10);
    expect(dashboard).not.toHaveProperty('id');
    expect(dashboard).not.toHaveProperty('tenantId');
  });

  test('alert list forwards GUID and paging filters verbatim and returns GUID-only rows', async () => {
    const args = { state: 'open', minimumSeverity: 'warning', assetGuid: ASSET_GUID, page: 2, pageSize: 25 };
    const response = await call('UteamupITManagementAlertsList', args, successReply({
      items: [{ alertGuid: ALERT_GUID, title: 'srv-dc-01 stopped reporting', status: 'open', currentSeverity: 'error', assetGuid: ASSET_GUID }],
      totalItems: 26,
      page: 2,
      pageSize: 25,
      totalPages: 2,
      hasPrevious: true,
      hasNext: false,
    }));
    const page = parse(response);
    expect(page.items[0].alertGuid).toMatch(GUID);
    expect(page.items[0]).not.toHaveProperty('id');
    expect(page.hasPrevious).toBe(true);
  });

  test('acknowledge and resolve send the reason code and return the confirmed alert', async () => {
    const acknowledged = await call('UteamupITManagementAlertAcknowledge',
      { alertGuid: ALERT_GUID, reasonCode: 'expected', note: 'planned' },
      successReply({ alertGuid: ALERT_GUID, status: 'acknowledged' }));
    expect(parse(acknowledged).status).toBe('acknowledged');
    const resolved = await call('UteamupITManagementAlertResolve',
      { alertGuid: ALERT_GUID, reasonCode: 'fixed' },
      successReply({ alertGuid: ALERT_GUID, status: 'resolvedByUser' }));
    expect(parse(resolved).status).toBe('resolvedByUser');
  });

  test('connections list is status-only: no secret, key or hash ever crosses the wire', async () => {
    const response = await call('UteamupITManagementConnectionsList', {}, successReply([{
      connectionGuid: ALERT_GUID,
      name: 'Contoso Azure',
      status: 'active',
      isEnabled: true,
      isValidated: true,
      lastSuccessfulSyncAtUtc: '2026-09-13T09:45:00Z',
      consecutiveFailures: 0,
      enabledSources: 12,
      availableSources: 5,
      monitoredSubscriptions: 3,
      subscriptionsNeedingAccess: 1,
      webhookVerified: true,
    }]));
    const rows = parse(response);
    expect(rows[0].connectionGuid).toMatch(GUID);
    expect(rows[0].monitoredSubscriptions).toBe(3);
    expect(rows[0].subscriptionsNeedingAccess).toBe(1);
    for (const forbidden of ['clientSecret', 'encryptedClientSecret', 'webhookKey', 'webhookKeyHash', 'webhookKeyPlaintext', 'subscriptionId', 'id']) {
      expect(rows[0]).not.toHaveProperty(forbidden);
    }
  });

  test('resources, rules, service map and flows return their summaries', async () => {
    const resources = await call('UteamupITManagementResourcesList', { unmappedOnly: true, page: 1, pageSize: 50 },
      successReply({ items: [{ resourceGuid: ASSET_GUID, name: 'vm-web-01', assetGuid: null }], totalItems: 1, page: 1, pageSize: 50, totalPages: 1, hasPrevious: false, hasNext: false }));
    expect(parse(resources).items[0].assetGuid).toBeNull();
    const rules = await call('UteamupITManagementRulesList', {}, successReply([{ ruleGuid: ALERT_GUID, name: 'Heartbeat missing', isSimulationOnly: true }]));
    expect(parse(rules)[0].isSimulationOnly).toBe(true);
    const map = await call('UteamupITManagementServiceMapSummary', { windowHours: 24 },
      successReply({ nodes: 12, edges: 8, discoveredEdges: 3, proposals: 2, truncated: false, topEdges: [] }));
    expect(parse(map).proposals).toBe(2);
    const flows = await call('UteamupITManagementFlowsSummary', { sourceAssetGuid: ASSET_GUID, window: '7d' },
      successReply({ items: [], totalItems: 0, page: 1, pageSize: 50, totalPages: 0, hasPrevious: false, hasNext: false }));
    expect(parse(flows).items).toEqual([]);
  });

  test('preserves backend JSON-RPC errors', async () => {
    const response = await call('UteamupITManagementDashboard', {}, errorReply(-32603, 'Feature not enabled: IT Management Preview access is required.'));
    expect(response.body.error.message).toContain('IT Management');
  });

  const tools = [
    { name: 'UteamupITManagementDashboard', args: {} },
    { name: 'UteamupITManagementAlertsList', args: { pageSize: 10 } },
    { name: 'UteamupITManagementAlertGet', args: { alertGuid: ALERT_GUID } },
    { name: 'UteamupITManagementAlertAcknowledge', args: { alertGuid: ALERT_GUID, reasonCode: 'expected' } },
    { name: 'UteamupITManagementAlertResolve', args: { alertGuid: ALERT_GUID, reasonCode: 'fixed' } },
    { name: 'UteamupITManagementRulesList', args: {} },
    { name: 'UteamupITManagementConnectionsList', args: {} },
    { name: 'UteamupITManagementResourcesList', args: { unmappedOnly: true } },
    { name: 'UteamupITManagementServiceMapSummary', args: { windowHours: 24 } },
    { name: 'UteamupITManagementFlowsSummary', args: { window: '24h' } },
  ];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
