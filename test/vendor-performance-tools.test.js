/**
 * Vendor Performance MCP tool tests
 *
 * Tests that Vendor Performance MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error
 * responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   UteamupVendorRatingSubmit(model)
 *   UteamupVendorRatingList(vendorGuid, page, pageSize)
 *   UteamupVendorRatingAggregate(vendorGuid)
 *   UteamupVendorRatingFlag(ratingGuid, model)
 *   UteamupVendorScorecardGet(vendorGuid)
 *   UteamupVendorScorecardConfigGet()
 *
 * Pattern mirrors labour-rate.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Vendor Performance MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_vendor_performance';
  const VENDOR_GUID = '11111111-1111-1111-1111-111111111111';
  const RATING_GUID = '22222222-2222-2222-2222-222222222222';
  const WORK_ORDER_GUID = '33333333-3333-3333-3333-333333333333';
  const MISSING_GUID = '99999999-9999-9999-9999-999999999999';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------
  const mockRating = {
    externalGuid: RATING_GUID,
    vendorGuid: VENDOR_GUID,
    workOrderGuid: WORK_ORDER_GUID,
    overallRating: 4.5,
    qualityRating: 5,
    timelinessRating: 4,
    communicationRating: 4,
    comment: 'Great work',
    createdAt: '2026-03-01T10:00:00Z',
    createdByUserId: 'user-guid-123'
  };

  const mockRatingList = [mockRating];

  const mockAggregate = {
    vendorGuid: VENDOR_GUID,
    averageOverall: 4.5,
    averageQuality: 4.8,
    averageTimeliness: 4.2,
    averageCommunication: 4.5,
    totalRatings: 25,
    ratingDistribution: { 5: 12, 4: 8, 3: 3, 2: 1, 1: 1 }
  };

  const mockScorecard = {
    externalGuid: '22222222-2222-2222-2222-222222222222',
    vendorGuid: VENDOR_GUID,
    vendorName: 'Acme Services',
    overallScore: 87.5,
    qualityScore: 90,
    deliveryScore: 85,
    complianceScore: 88,
    costScore: 87,
    lastUpdated: '2026-03-01T00:00:00Z',
    trend: 'Improving'
  };

  const mockScorecardConfig = {
    externalGuid: '33333333-3333-3333-3333-333333333333',
    qualityWeight: 30,
    deliveryWeight: 25,
    complianceWeight: 25,
    costWeight: 20,
    evaluationPeriodDays: 90,
    minimumRatingsRequired: 5
  };

  // ---------------------------------------------------------------------------
  // UteamupVendorRatingSubmit
  // ---------------------------------------------------------------------------
  describe('UteamupVendorRatingSubmit tool', () => {
    test('submits rating successfully', async () => {
      const response = await call(
        'UteamupVendorRatingSubmit',
        { model: { vendorGuid: VENDOR_GUID, workOrderGuid: WORK_ORDER_GUID, ratingType: 2, overallRating: 5, qualityRating: 5, comment: 'Great work', isGeoVerified: false, isAnonymized: false } },
        successReply(mockRating)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.overallRating).toBe(4.5);
      expect(data.vendorGuid).toBe(VENDOR_GUID);
      expect(data.comment).toBe('Great work');
    });

    test('returns validation error when model is invalid', async () => {
      const response = await call(
        'UteamupVendorRatingSubmit',
        { model: { vendorGuid: '00000000-0000-0000-0000-000000000000' } },
        errorReply(-32602, 'VendorGuid is required')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('VendorGuid');
    });

    test('returns error when overallRating is out of range', async () => {
      const response = await call(
        'UteamupVendorRatingSubmit',
        { model: { vendorGuid: VENDOR_GUID, overallRating: 6 } },
        errorReply(-32602, 'OverallRating must be between 1 and 5')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('OverallRating');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupVendorRatingList
  // ---------------------------------------------------------------------------
  describe('UteamupVendorRatingList tool', () => {
    test('returns paginated ratings for a vendor', async () => {
      const response = await call(
        'UteamupVendorRatingList',
        { vendorGuid: VENDOR_GUID, page: 1, pageSize: 10 },
        successReply(mockRatingList)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(1);
      expect(data[0].vendorGuid).toBe(VENDOR_GUID);
    });

    test('returns empty list when vendor has no ratings', async () => {
      const emptyList = [];

      const response = await call(
        'UteamupVendorRatingList',
        { vendorGuid: MISSING_GUID, page: 1, pageSize: 10 },
        successReply(emptyList)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupVendorRatingAggregate
  // ---------------------------------------------------------------------------
  describe('UteamupVendorRatingAggregate tool', () => {
    test('returns aggregate ratings for a vendor', async () => {
      const response = await call(
        'UteamupVendorRatingAggregate',
        { vendorGuid: VENDOR_GUID },
        successReply(mockAggregate)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.averageOverall).toBe(4.5);
      expect(data.totalRatings).toBe(25);
      expect(data.ratingDistribution).toBeDefined();
    });

    test('returns error when vendor not found', async () => {
      const response = await call(
        'UteamupVendorRatingAggregate',
        { vendorGuid: MISSING_GUID },
        errorReply(-32000, 'Vendor not found')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Vendor not found');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupVendorRatingFlag
  // ---------------------------------------------------------------------------
  describe('UteamupVendorRatingFlag tool', () => {
    test('flags a rating for review successfully', async () => {
      const flaggedRating = { ...mockRating, isFlagged: true, flagReason: 'Inappropriate content' };

      const response = await call(
        'UteamupVendorRatingFlag',
        { ratingGuid: RATING_GUID, model: { reason: 'Inappropriate content' } },
        successReply(flaggedRating)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.isFlagged).toBe(true);
      expect(data.flagReason).toBe('Inappropriate content');
    });

    test('returns error when rating not found', async () => {
      const response = await call(
        'UteamupVendorRatingFlag',
        { ratingGuid: MISSING_GUID, model: { reason: 'Spam' } },
        errorReply(-32000, 'Rating not found')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Rating not found');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupVendorScorecardGet
  // ---------------------------------------------------------------------------
  describe('UteamupVendorScorecardGet tool', () => {
    test('returns scorecard for a vendor', async () => {
      const response = await call(
        'UteamupVendorScorecardGet',
        { vendorGuid: VENDOR_GUID },
        successReply(mockScorecard)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.overallScore).toBe(87.5);
      expect(data.vendorName).toBe('Acme Services');
      expect(data.trend).toBe('Improving');
    });

    test('returns error when vendor not found', async () => {
      const response = await call(
        'UteamupVendorScorecardGet',
        { vendorGuid: '99999999-9999-9999-9999-999999999999' },
        errorReply(-32000, 'Vendor not found')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Vendor not found');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupVendorScorecardConfigGet
  // ---------------------------------------------------------------------------
  describe('UteamupVendorScorecardConfigGet tool', () => {
    test('returns scorecard configuration for a vendor', async () => {
      const response = await call(
        'UteamupVendorScorecardConfigGet',
        {},
        successReply(mockScorecardConfig)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.qualityWeight).toBe(30);
      expect(data.deliveryWeight).toBe(25);
      expect(data.evaluationPeriodDays).toBe(90);
      expect(data.minimumRatingsRequired).toBe(5);
    });

    test('returns default config when none is explicitly set', async () => {
      const defaultConfig = {
        externalGuid: '44444444-4444-4444-4444-444444444444',
        qualityWeight: 25,
        deliveryWeight: 25,
        complianceWeight: 25,
        costWeight: 25,
        evaluationPeriodDays: 30,
        minimumRatingsRequired: 3
      };

      const response = await call(
        'UteamupVendorScorecardConfigGet',
        {},
        successReply(defaultConfig)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.qualityWeight + data.deliveryWeight + data.complianceWeight + data.costWeight).toBe(100);
    });
  });

  // ---------------------------------------------------------------------------
  // Shared error-handling tests (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupVendorRatingSubmit', args: { model: { vendorGuid: VENDOR_GUID, overallRating: 5 } } },
    { name: 'UteamupVendorRatingList', args: { vendorGuid: VENDOR_GUID, page: 1, pageSize: 10 } },
    { name: 'UteamupVendorRatingAggregate', args: { vendorGuid: VENDOR_GUID } },
    { name: 'UteamupVendorRatingFlag', args: { ratingGuid: RATING_GUID, model: { reason: 'Spam' } } },
    { name: 'UteamupVendorScorecardGet', args: { vendorGuid: VENDOR_GUID } },
    { name: 'UteamupVendorScorecardConfigGet', args: {} }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
