/**
 * Generic-proxy contract for the backend-registered Inventory Insights tools:
 * UteamupAssetInsightsGet (read), UteamupAssetRcaDraft (AI draft, read-only) and
 * UteamupAssetRcaCreateFromDraft (write).
 */
'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

const BASE_URL = 'https://api.test.com';
const ACCESS_TOKEN = 'test_access_token_asset_insights';
const ASSET_GUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const WORKORDER_GUID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const RCA_GUID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const callTool = (name, toolArgs, mockReply) =>
  _callMcpTool(BASE_URL, ACCESS_TOKEN, name, toolArgs, mockReply);

describe('UteamupAssetInsightsGet MCP tool', () => {
  const args = { assetGuid: ASSET_GUID, monthsBack: 6 };
  const call = mockReply => callTool('UteamupAssetInsightsGet', args, mockReply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  it('round-trips totals, the monthly timeline and GUID-only work orders', async () => {
    const response = await call(successReply({
      entityType: 'asset',
      entityGuid: ASSET_GUID,
      entityName: 'Main compressor',
      monthsBack: 6,
      totals: { total: 7, open: 2, inProgress: 1, onHold: 0, completed: 3, cancelled: 1, overdue: 1 },
      timeline: [{ period: '2026-04', created: 2, completed: 1, cancelled: 0 }],
      byStatus: [{ key: 'Completed', count: 3 }],
      workorders: [{ guid: WORKORDER_GUID, ticketId: 'WO-100', name: 'Replace bearing', status: 4, statusName: 'Completed' }],
      rootCauseAnalyses: [{ guid: RCA_GUID, title: 'Bearing overheating', status: 'Draft', severity: 'High' }],
      supportsRootCauseAnalysis: true,
    }));

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.totals.total).toBe(7);
    expect(data.timeline[0].period).toBe('2026-04');
    expect(data.workorders[0].guid).toBe(WORKORDER_GUID);
    expect(data.workorders[0]).not.toHaveProperty('id');
    expect(data.rootCauseAnalyses[0].guid).toBe(RCA_GUID);
  });

  it('surfaces an unknown asset as null', async () => {
    const response = await call(successReply(null));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toBeNull();
  });

  it('surfaces permission failures as JSON-RPC errors', async () => {
    const response = await call(errorReply(-32000, 'Permission denied: Asset.View required'));
    expect(response.body.error.message).toMatch(/Asset\.View/);
  });

  it('forwards the assetGuid and monthsBack arguments verbatim — never a tenantId or userId', async () => {
    // The nock matcher only replies when the forwarded arguments deep-equal `args`, so any
    // injected tenant/user identity (or a dropped monthsBack) would fail the request.
    const response = await _callMcpTool(
      BASE_URL,
      ACCESS_TOKEN,
      'UteamupAssetInsightsGet',
      args,
      successReply({ entityGuid: ASSET_GUID, monthsBack: 6 }),
      args,
    );
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.monthsBack).toBe(6);
  });
});

describe('UteamupAssetRcaDraft MCP tool', () => {
  const args = { assetGuid: ASSET_GUID, monthsBack: 12, focus: 'bearing heat' };
  const call = mockReply => callTool('UteamupAssetRcaDraft', args, mockReply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  it('round-trips the reviewable draft with credits and analyzed work orders', async () => {
    const response = await call(successReply({
      assetGuid: ASSET_GUID,
      assetName: 'Main compressor',
      draft: {
        title: 'Recurring bearing overheating',
        problemStatement: 'Trips on bearing temperature every few weeks.',
        severity: 'High',
        confidence: 'medium',
        whys: [{ question: 'Why does it overheat?', answer: 'Lubrication starves.', evidence: 'WO-100' }],
        rootCause: 'No refill task in the PM plan.',
        actions: [{ actionType: 'PreventiveMaintenance', description: 'Add a monthly refill task.' }],
        assumptions: [],
      },
      analyzedWorkorderGuids: [WORKORDER_GUID],
      analyzedWorkorderCount: 1,
      analyzedFailureCount: 0,
      creditsCharged: 10,
      remaining: 90,
      warnings: [],
    }));

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.draft.whys).toHaveLength(1);
    expect(data.analyzedWorkorderGuids[0]).toBe(WORKORDER_GUID);
    expect(data.creditsCharged).toBe(10);
  });

  it('carries a quota block on the result instead of an error', async () => {
    const response = await call(successReply({
      assetGuid: ASSET_GUID,
      draft: null,
      quotaBlockedReason: 'QuotaExceeded',
      creditsCharged: 0,
      remaining: 0,
      warnings: [],
    }));

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.quotaBlockedReason).toBe('QuotaExceeded');
    expect(data.draft).toBeNull();
  });

  it('surfaces permission failures as JSON-RPC errors', async () => {
    const response = await call(errorReply(-32000, 'Permission denied: RootCauseAnalysis.Create and AI.Use required'));
    expect(response.body.error.message).toMatch(/RootCauseAnalysis\.Create/);
  });
});

describe('UteamupAssetRcaCreateFromDraft MCP tool', () => {
  const args = {
    assetGuid: ASSET_GUID,
    request: {
      draft: { title: 'Recurring bearing overheating', problemStatement: 'Trips every few weeks', severity: 'High', whys: [], actions: [], assumptions: [] },
      workorderGuids: [WORKORDER_GUID],
    },
  };
  const call = mockReply => callTool('UteamupAssetRcaCreateFromDraft', args, mockReply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  it('returns the created analysis by GUID', async () => {
    const response = await call(successReply({
      externalGuid: RCA_GUID,
      title: 'Recurring bearing overheating',
      status: 'Draft',
      linkedAssets: [{ assetGuid: ASSET_GUID, assetName: 'Main compressor' }],
      linkedWorkOrders: [{ workOrderGuid: WORKORDER_GUID, workOrderName: 'Replace bearing' }],
    }));

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.externalGuid).toBe(RCA_GUID);
    expect(data.linkedWorkOrders[0].workOrderGuid).toBe(WORKORDER_GUID);
  });

  it('surfaces validation failures as JSON-RPC errors', async () => {
    const response = await call(errorReply(-32602, 'The draft title is required'));
    expect(response.body.error.message).toMatch(/title/i);
  });
});

const tools = [
  { name: 'UteamupAssetInsightsGet', args: { assetGuid: ASSET_GUID } },
  { name: 'UteamupAssetRcaDraft', args: { assetGuid: ASSET_GUID } },
  {
    name: 'UteamupAssetRcaCreateFromDraft',
    args: { assetGuid: ASSET_GUID, request: { draft: { title: 't', problemStatement: 'p' }, workorderGuids: [] } },
  },
];
describeJsonRpcCompliance(callTool, tools);
describe401Unauthorized(BASE_URL, tools);
describe503ServiceUnavailable(BASE_URL, tools);
