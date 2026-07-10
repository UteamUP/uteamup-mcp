/**
 * Stock seasonal intelligence MCP tools test (stock-ai-seasonal-intelligence section 12).
 *
 * Eight tools over the deterministic seasonal engine + the quota-charged AI narrative:
 * UteamupStockGetItemSeasonality, UteamupStockGetSeasonalityReport,
 * UteamupStockGetUpcomingPeaks, UteamupStockListSeasonWindows,
 * UteamupStockSetSeasonWindows, UteamupStockRecomputeSeasonality,
 * UteamupStockApplySeasonalSuggestion, UteamupStockGenerateSeasonalInsights.
 * Generic-proxy pattern: nock-mocked backend /mcp POST, no real network.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  sendRawRequest,
  successReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Stock seasonal intelligence MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_stock_seasonality';

  const ITEM_GUID = 'a1111111-1111-1111-1111-111111111111';
  const WINDOW_GUID = 'b2222222-2222-2222-2222-222222222222';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  /** Capture the forwarded JSON-RPC body for argument round-trip assertions. */
  const captureCall = async (toolName, toolArgs) => {
    let captured = null;
    nock(BASE_URL)
      .post('/mcp', body => {
        captured = body;
        return body.method === 'tools/call' && body.params?.name === toolName;
      })
      .reply(200, JSON.stringify(successReply({}).body), { 'Content-Type': 'application/json' });
    await sendRawRequest(BASE_URL, toolName, toolArgs);
    return captured;
  };

  describe('UteamupStockGetItemSeasonality', () => {
    it('returns the full seasonal profile with window projections', async () => {
      const response = await call(
        'UteamupStockGetItemSeasonality',
        { itemGuid: ITEM_GUID },
        successReply({
          stockItemGuid: ITEM_GUID,
          name: 'Snow Shovel',
          confidence: 'High',
          isSeasonal: true,
          seasonalityStrength: 0.82,
          monthlyIndices: [1.8, 1.6, 0.9, 0.5, 0.3, 0.2, 0.2, 0.3, 0.6, 1.0, 1.5, 1.9],
          peakMonths: [11, 12, 1, 2],
          perMonthReorderPoints: [30, 27, 15, 8, 5, 3, 3, 5, 10, 17, 25, 32],
          windows: [
            {
              windowGuid: WINDOW_GUID,
              windowName: 'Winter',
              expectedDemand: 120,
              recommendedStock: 132,
              shortfall: 40,
              orderByDate: '2026-10-15T00:00:00Z',
            },
          ],
          currentStock: 92,
        }),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.stockItemGuid).toBe(ITEM_GUID);
      expect(data.isSeasonal).toBe(true);
      expect(data.monthlyIndices).toHaveLength(12);
      expect(data.windows[0].windowGuid).toBe(WINDOW_GUID);
      expect(data.windows[0].shortfall).toBe(40);
    });

    it('forwards the item GUID verbatim (GUIDs only, no int ids)', async () => {
      const captured = await captureCall('UteamupStockGetItemSeasonality', { itemGuid: ITEM_GUID });
      expect(captured.params.arguments).toEqual({ itemGuid: ITEM_GUID });
    });
  });

  describe('UteamupStockGetSeasonalityReport', () => {
    it('returns the paged most-seasonal-first report', async () => {
      const response = await call(
        'UteamupStockGetSeasonalityReport',
        { onlySeasonal: true, page: 1, pageSize: 50 },
        successReply({
          items: [
            { stockItemGuid: ITEM_GUID, name: 'Snow Shovel', isSeasonal: true, seasonalityStrength: 0.82, confidence: 'High' },
          ],
          totalItems: 1,
          page: 1,
          pageSize: 50,
        }),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.totalItems).toBe(1);
      expect(data.items[0].isSeasonal).toBe(true);
    });

    it('forwards onlySeasonal + paging unchanged', async () => {
      const captured = await captureCall('UteamupStockGetSeasonalityReport', {
        onlySeasonal: true,
        page: 3,
        pageSize: 25,
      });
      expect(captured.params.arguments).toEqual({ onlySeasonal: true, page: 3, pageSize: 25 });
    });
  });

  describe('UteamupStockGetUpcomingPeaks', () => {
    it('returns the pre-season stock-up checklist with shortfall math', async () => {
      const response = await call(
        'UteamupStockGetUpcomingPeaks',
        { horizonDays: 90, page: 1, pageSize: 50 },
        successReply({
          items: [
            {
              stockItemGuid: ITEM_GUID,
              name: 'Antifreeze',
              seasonName: 'Winter',
              expectedDemand: 200,
              currentStock: 80,
              recommendedStock: 220,
              shortfall: 140,
              orderByDate: '2026-10-01T00:00:00Z',
            },
          ],
          totalItems: 1,
          page: 1,
          pageSize: 50,
        }),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.items[0].shortfall).toBe(140);
      expect(data.items[0].seasonName).toBe('Winter');
    });

    it('forwards the horizon unchanged', async () => {
      const captured = await captureCall('UteamupStockGetUpcomingPeaks', {
        horizonDays: 30,
        page: 2,
        pageSize: 10,
      });
      expect(captured.params.arguments).toEqual({ horizonDays: 30, page: 2, pageSize: 10 });
    });
  });

  describe('UteamupStockListSeasonWindows', () => {
    it('returns the tenant season windows', async () => {
      const response = await call(
        'UteamupStockListSeasonWindows',
        {},
        successReply([
          { guid: WINDOW_GUID, name: 'Winter', startMonth: 11, startDay: 1, endMonth: 2, endDay: 28, isActive: true },
        ]),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].guid).toBe(WINDOW_GUID);
      expect(data[0].startMonth).toBe(11);
    });
  });

  describe('UteamupStockSetSeasonWindows', () => {
    it('forwards the complete replace-by-guid window set verbatim', async () => {
      const windows = [
        { guid: WINDOW_GUID, name: 'Winter', startMonth: 11, startDay: 1, endMonth: 2, endDay: 28, isActive: true },
        { name: 'Harvest', startMonth: 8, startDay: 15, endMonth: 10, endDay: 15, isActive: true, color: '#f59e0b' },
      ];
      const captured = await captureCall('UteamupStockSetSeasonWindows', { windows });
      expect(captured.params.arguments).toEqual({ windows });
    });
  });

  describe('UteamupStockRecomputeSeasonality', () => {
    it('returns the number of profiles written', async () => {
      const response = await call('UteamupStockRecomputeSeasonality', {}, successReply(17));
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toBe(17);
    });
  });

  describe('UteamupStockApplySeasonalSuggestion', () => {
    it('forwards fields + targetMonth unchanged (server recomputes — no client numbers)', async () => {
      const captured = await captureCall('UteamupStockApplySeasonalSuggestion', {
        itemGuid: ITEM_GUID,
        fields: ['reorderPoint', 'minimumAmount'],
        targetMonth: 12,
      });
      expect(captured.params.arguments).toEqual({
        itemGuid: ITEM_GUID,
        fields: ['reorderPoint', 'minimumAmount'],
        targetMonth: 12,
      });
      // Tamper-proofing: the tool takes NO numeric override args.
      expect(captured.params.arguments.reorderPoint).toBeUndefined();
      expect(captured.params.arguments.minimumAmount).toBeUndefined();
    });

    it('returns the updated stock item', async () => {
      const response = await call(
        'UteamupStockApplySeasonalSuggestion',
        { itemGuid: ITEM_GUID, fields: ['reorderPoint'] },
        successReply({ guid: ITEM_GUID, reorderPoint: 32 }),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.guid).toBe(ITEM_GUID);
      expect(data.reorderPoint).toBe(32);
    });
  });

  describe('UteamupStockGenerateSeasonalInsights', () => {
    it('returns AI insights with quota accounting', async () => {
      const response = await call(
        'UteamupStockGenerateSeasonalInsights',
        {},
        successReply({
          insights: [
            { title: 'Winter demand spike', detail: 'Snow shovels peak Nov-Feb', recommendedAction: 'Order by Oct 15', stockItemGuid: ITEM_GUID },
          ],
          provider: 'openai',
          creditsCharged: 1,
          remaining: 41,
        }),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.insights[0].title).toBe('Winter demand spike');
      expect(data.creditsCharged).toBe(1);
    });

    it('surfaces quota exhaustion on the body, never as an error', async () => {
      const response = await call(
        'UteamupStockGenerateSeasonalInsights',
        {},
        successReply({ insights: [], creditsCharged: 0, quotaBlockedReason: 'AI quota exhausted' }),
      );
      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.quotaBlockedReason).toBe('AI quota exhausted');
    });
  });

  describe('identity comes from the Bearer token (spoofing guard)', () => {
    it.each([
      ['UteamupStockGetSeasonalityReport', { page: 1, pageSize: 50 }],
      ['UteamupStockRecomputeSeasonality', {}],
      ['UteamupStockGenerateSeasonalInsights', {}],
    ])('%s takes no userId / tenantId argument', async (name, args) => {
      const captured = await captureCall(name, args);
      expect(captured.params.arguments.userId).toBeUndefined();
      expect(captured.params.arguments.tenantId).toBeUndefined();
      expect(captured.params.arguments.tenantGuid).toBeUndefined();
    });
  });

  const allTools = [
    { name: 'UteamupStockGetItemSeasonality', args: { itemGuid: ITEM_GUID } },
    { name: 'UteamupStockGetSeasonalityReport', args: { page: 1, pageSize: 50 } },
    { name: 'UteamupStockGetUpcomingPeaks', args: { horizonDays: 90, page: 1, pageSize: 50 } },
    { name: 'UteamupStockListSeasonWindows', args: {} },
    {
      name: 'UteamupStockSetSeasonWindows',
      args: { windows: [{ name: 'Winter', startMonth: 11, startDay: 1, endMonth: 2, endDay: 28, isActive: true }] },
    },
    { name: 'UteamupStockRecomputeSeasonality', args: {} },
    { name: 'UteamupStockApplySeasonalSuggestion', args: { itemGuid: ITEM_GUID, fields: ['reorderPoint'] } },
    { name: 'UteamupStockGenerateSeasonalInsights', args: {} },
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
