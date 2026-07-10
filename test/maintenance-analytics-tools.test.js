/**
 * Maintenance Analytics MCP tool tests
 *
 * Tests that Maintenance Analytics MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error
 * responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   UteamupReliabilityMetricsGet(timeframe?, startDate?, endDate?, assetId?)
 *   UteamupOeeMetricsGet(timeframe?, assetId?, performanceRate?, qualityRate?)
 *   UteamupPmComplianceGet(timeframe?, locationId?)
 *   UteamupMaintenanceScorecardGet()
 *   UteamupRepairReplaceAnalysisGet(workorderId)
 *   UteamupWarrantyExpirationSummaryGet()
 *
 * Pattern mirrors vendor-performance-tools.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Maintenance Analytics MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_analytics';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------
  const mockReliability = {
    averageMttr: 4.5,
    averageMtbf: 720.0,
    firstTimeFixRate: 85.5,
    assetRecords: [{ assetId: 1, assetName: 'Pump A', mttr: 3.2, mtbf: 800, failureCount: 5 }],
    trendData: [{ date: '2026-02-01', mttr: 4.0, mtbf: 700 }]
  };

  const mockOee = {
    overallOee: 72.5,
    averageAvailability: 90.0,
    averagePerformance: 85.0,
    averageQuality: 95.0,
    performanceRateUsed: 85.0,
    qualityRateUsed: 95.0,
    assetRecords: [{ assetId: 1, assetName: 'Pump A', oee: 75.0, availability: 92.0 }]
  };

  const mockPmCompliance = {
    overallCompliance: 87.5,
    totalPms: 100,
    onTimePms: 75,
    latePms: 12,
    overduePms: 5,
    pendingPms: 8,
    planRecords: [],
    trendData: [],
    overdueRecords: []
  };

  const mockScorecard = {
    compositeScore: 78.5,
    letterGrade: 'B',
    components: [{ name: 'PM Compliance', score: 85, weight: 30, rawValue: '87.5%' }],
    trendData: [{ date: '2026-02-01', score: 76.0 }],
    recommendations: ['Improve PM completion rate']
  };

  const mockRepairReplace = {
    recommendation: 'Repair',
    score: 35.0,
    confidence: 'Medium',
    repairCost: 500.0,
    replacementCost: 5000.0,
    factors: [{ name: 'Cost Ratio', value: 10.0, description: 'Low cost ratio favors repair' }]
  };

  const mockWarrantyExpiration = {
    expiring30Days: 3,
    expiring90Days: 8,
    expired: 2,
    active: 45
  };

  // ---------------------------------------------------------------------------
  // UteamupReliabilityMetricsGet
  // ---------------------------------------------------------------------------
  describe('UteamupReliabilityMetricsGet tool', () => {
    test('returns reliability metrics successfully', async () => {
      const response = await call(
        'UteamupReliabilityMetricsGet',
        { timeframe: 'Last30Days' },
        successReply(mockReliability)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.averageMttr).toBe(4.5);
      expect(data.averageMtbf).toBe(720.0);
      expect(data.firstTimeFixRate).toBe(85.5);
      expect(data.assetRecords).toHaveLength(1);
      expect(data.assetRecords[0].assetName).toBe('Pump A');
      expect(data.trendData).toHaveLength(1);
    });

    test('returns reliability metrics with date range filter', async () => {
      const response = await call(
        'UteamupReliabilityMetricsGet',
        { startDate: '2026-01-01', endDate: '2026-02-28', assetId: 1 },
        successReply(mockReliability)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.assetRecords[0].assetId).toBe(1);
      expect(data.assetRecords[0].failureCount).toBe(5);
    });

    test('returns error when backend fails', async () => {
      const response = await call(
        'UteamupReliabilityMetricsGet',
        { timeframe: 'Last30Days' },
        errorReply(-32000, 'Failed to compute reliability metrics')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('reliability metrics');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupOeeMetricsGet
  // ---------------------------------------------------------------------------
  describe('UteamupOeeMetricsGet tool', () => {
    test('returns OEE metrics successfully', async () => {
      const response = await call(
        'UteamupOeeMetricsGet',
        { timeframe: 'Last30Days' },
        successReply(mockOee)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.overallOee).toBe(72.5);
      expect(data.averageAvailability).toBe(90.0);
      expect(data.averagePerformance).toBe(85.0);
      expect(data.averageQuality).toBe(95.0);
      expect(data.assetRecords).toHaveLength(1);
      expect(data.assetRecords[0].oee).toBe(75.0);
    });

    test('returns OEE metrics with custom performance and quality rates', async () => {
      const response = await call(
        'UteamupOeeMetricsGet',
        { assetId: 1, performanceRate: 90.0, qualityRate: 98.0 },
        successReply({ ...mockOee, performanceRateUsed: 90.0, qualityRateUsed: 98.0 })
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.performanceRateUsed).toBe(90.0);
      expect(data.qualityRateUsed).toBe(98.0);
    });

    test('returns error when backend fails', async () => {
      const response = await call(
        'UteamupOeeMetricsGet',
        { timeframe: 'Last30Days' },
        errorReply(-32000, 'Failed to compute OEE metrics')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('OEE metrics');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupPmComplianceGet
  // ---------------------------------------------------------------------------
  describe('UteamupPmComplianceGet tool', () => {
    test('returns PM compliance data successfully', async () => {
      const response = await call(
        'UteamupPmComplianceGet',
        { timeframe: 'Last90Days' },
        successReply(mockPmCompliance)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.overallCompliance).toBe(87.5);
      expect(data.totalPms).toBe(100);
      expect(data.onTimePms).toBe(75);
      expect(data.latePms).toBe(12);
      expect(data.overduePms).toBe(5);
      expect(data.pendingPms).toBe(8);
    });

    test('returns PM compliance filtered by location', async () => {
      const response = await call(
        'UteamupPmComplianceGet',
        { timeframe: 'Last30Days', locationId: 42 },
        successReply(mockPmCompliance)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.overallCompliance).toBe(87.5);
      expect(data.planRecords).toEqual([]);
    });

    test('returns error when backend fails', async () => {
      const response = await call(
        'UteamupPmComplianceGet',
        { timeframe: 'Last30Days' },
        errorReply(-32000, 'Failed to compute PM compliance')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('PM compliance');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupMaintenanceScorecardGet
  // ---------------------------------------------------------------------------
  describe('UteamupMaintenanceScorecardGet tool', () => {
    test('returns maintenance scorecard successfully', async () => {
      const response = await call(
        'UteamupMaintenanceScorecardGet',
        {},
        successReply(mockScorecard)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.compositeScore).toBe(78.5);
      expect(data.letterGrade).toBe('B');
      expect(data.components).toHaveLength(1);
      expect(data.components[0].name).toBe('PM Compliance');
      expect(data.components[0].score).toBe(85);
      expect(data.recommendations).toContain('Improve PM completion rate');
    });

    test('returns scorecard with trend data', async () => {
      const response = await call(
        'UteamupMaintenanceScorecardGet',
        {},
        successReply(mockScorecard)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.trendData).toHaveLength(1);
      expect(data.trendData[0].date).toBe('2026-02-01');
      expect(data.trendData[0].score).toBe(76.0);
    });

    test('returns error when backend fails', async () => {
      const response = await call(
        'UteamupMaintenanceScorecardGet',
        {},
        errorReply(-32000, 'Failed to compute maintenance scorecard')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('maintenance scorecard');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupRepairReplaceAnalysisGet
  // ---------------------------------------------------------------------------
  describe('UteamupRepairReplaceAnalysisGet tool', () => {
    test('returns repair/replace analysis successfully', async () => {
      const response = await call(
        'UteamupRepairReplaceAnalysisGet',
        { workorderId: 101 },
        successReply(mockRepairReplace)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.recommendation).toBe('Repair');
      expect(data.score).toBe(35.0);
      expect(data.confidence).toBe('Medium');
      expect(data.repairCost).toBe(500.0);
      expect(data.replacementCost).toBe(5000.0);
      expect(data.factors).toHaveLength(1);
      expect(data.factors[0].name).toBe('Cost Ratio');
    });

    test('returns replace recommendation for high-cost asset', async () => {
      const replaceResult = {
        recommendation: 'Replace',
        score: 82.0,
        confidence: 'High',
        repairCost: 4500.0,
        replacementCost: 5000.0,
        factors: [{ name: 'Cost Ratio', value: 90.0, description: 'High cost ratio favors replacement' }]
      };

      const response = await call(
        'UteamupRepairReplaceAnalysisGet',
        { workorderId: 202 },
        successReply(replaceResult)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.recommendation).toBe('Replace');
      expect(data.score).toBe(82.0);
      expect(data.confidence).toBe('High');
    });

    test('returns error when work order not found', async () => {
      const response = await call(
        'UteamupRepairReplaceAnalysisGet',
        { workorderId: 99999 },
        errorReply(-32000, 'Work order not found')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Work order not found');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWarrantyExpirationSummaryGet
  // ---------------------------------------------------------------------------
  describe('UteamupWarrantyExpirationSummaryGet tool', () => {
    test('returns warranty expiration summary successfully', async () => {
      const response = await call(
        'UteamupWarrantyExpirationSummaryGet',
        {},
        successReply(mockWarrantyExpiration)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.expiring30Days).toBe(3);
      expect(data.expiring90Days).toBe(8);
      expect(data.expired).toBe(2);
      expect(data.active).toBe(45);
    });

    test('returns zero counts when no warranties exist', async () => {
      const emptyWarranties = {
        expiring30Days: 0,
        expiring90Days: 0,
        expired: 0,
        active: 0
      };

      const response = await call(
        'UteamupWarrantyExpirationSummaryGet',
        {},
        successReply(emptyWarranties)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.expiring30Days).toBe(0);
      expect(data.expiring90Days).toBe(0);
      expect(data.expired).toBe(0);
      expect(data.active).toBe(0);
    });

    test('returns error when backend fails', async () => {
      const response = await call(
        'UteamupWarrantyExpirationSummaryGet',
        {},
        errorReply(-32000, 'Failed to retrieve warranty expiration summary')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('warranty expiration summary');
    });
  });

  // ---------------------------------------------------------------------------
  // Shared error-handling tests (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupReliabilityMetricsGet', args: { timeframe: 'Last30Days' } },
    { name: 'UteamupOeeMetricsGet', args: { timeframe: 'Last30Days' } },
    { name: 'UteamupPmComplianceGet', args: { timeframe: 'Last30Days' } },
    { name: 'UteamupMaintenanceScorecardGet', args: {} },
    { name: 'UteamupRepairReplaceAnalysisGet', args: { workorderId: 101 } },
    { name: 'UteamupWarrantyExpirationSummaryGet', args: {} }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
