/**
 * Document Import + Review + AI Usage MCP tool tests
 *
 * Covers the 5 MCP tools added for the image/document import feature:
 *   - UteamupDocumentImportGetBatch
 *   - UteamupLogbookImportGet
 *   - UteamupDocumentReviewQueue
 *   - UteamupDocumentReviewAcknowledge
 *   - UteamupAIUsageSummary
 *
 * Each test verifies the proxy forwards the JSON-RPC tools/call request and
 * returns whatever the backend MCP endpoint emits. Pattern mirrors
 * project-my-projects.test.js — nock-mocked HTTPS calls, no real backend.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');

describe('Document Import / Review / AI Usage MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_document_import';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ── UteamupDocumentImportGetBatch ──────────────────────────────────────

  describe('UteamupDocumentImportGetBatch', () => {
    const batchPayload = {
      id: 42,
      tenantGuid: '11111111-1111-1111-1111-111111111111',
      title: 'Turbine PM 2026-04',
      source: 1,
      status: 2,
      totalItems: 2,
      processedItems: 2,
      failedItems: 0,
      skippedAnalysisItems: 1,
      aiQuotaExhausted: true,
      createdAt: '2026-04-15T10:00:00Z',
      updatedAt: '2026-04-15T10:05:00Z',
      items: [
        {
          documentId: 1001,
          fileName: 'turbine.jpg',
          contentType: 'image/jpeg',
          aiAnalysisStatus: 3,
          tags: [{ tagId: 1, tagName: 'turbine', isAiSuggested: true }],
          assetIds: [10],
          codeCatalogEntries: [],
          unresolvedAssetCodes: [],
        },
      ],
    };

    it('returns batch payload including aiQuotaExhausted flag', async () => {
      const response = await call(
        'UteamupDocumentImportGetBatch',
        { batchId: 42 },
        successReply(batchPayload),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.id).toBe(42);
      expect(data.aiQuotaExhausted).toBe(true);
      expect(data.skippedAnalysisItems).toBe(1);
      expect(data.items[0].tags[0].isAiSuggested).toBe(true);
    });

    it('returns null when the batch is not found', async () => {
      const response = await call(
        'UteamupDocumentImportGetBatch',
        { batchId: 9999 },
        successReply(null),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toBeNull();
    });
  });

  // ── UteamupLogbookImportGet ────────────────────────────────────────────

  describe('UteamupLogbookImportGet', () => {
    it('returns parsed logbook with entries', async () => {
      const payload = {
        id: 7,
        documentImportBatchId: 77,
        sourceDocumentId: 99,
        status: 1,
        parsedEntryCount: 2,
        committedJournalCount: 0,
        entries: [
          {
            id: 501,
            parsedDate: '2026-04-10T00:00:00Z',
            parsedHeading: 'Start of shift',
            parsedBodyHtml: '<p>HVAC inspection complete</p>',
            isIgnored: false,
          },
        ],
        warnings: ['entry 502 missing heading'],
      };

      const response = await call(
        'UteamupLogbookImportGet',
        { batchId: 77 },
        successReply(payload),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.documentImportBatchId).toBe(77);
      expect(data.entries).toHaveLength(1);
      expect(data.warnings).toContain('entry 502 missing heading');
    });
  });

  // ── UteamupDocumentReviewQueue ─────────────────────────────────────────

  describe('UteamupDocumentReviewQueue', () => {
    it('returns paginated queue items with ack thresholds', async () => {
      const items = [
        {
          documentId: 1001,
          fileName: 'turbine.jpg',
          contentType: 'image/jpeg',
          sourceType: 1,
          aiAnalysisStatus: 3,
          aiDescription: 'Turbine inspection',
          importBatchId: 42,
          importBatchTitle: 'Turbine PM',
          acknowledgmentCount: 1,
          effectiveReviewerThreshold: 2,
          createdAt: '2026-04-15T10:00:00Z',
          ackedByCurrentUser: false,
        },
      ];
      const response = await call(
        'UteamupDocumentReviewQueue',
        { page: 1, pageSize: 25 },
        successReply(items),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].effectiveReviewerThreshold).toBe(2);
      expect(data[0].ackedByCurrentUser).toBe(false);
    });

    it('accepts optional batchId filter', async () => {
      const response = await call(
        'UteamupDocumentReviewQueue',
        { page: 1, pageSize: 50, batchId: 42 },
        successReply([]),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toEqual([]);
    });

    it('surfaces 503 from the backend as JSON-RPC error', async () => {
      const response = await call(
        'UteamupDocumentReviewQueue',
        { page: 1, pageSize: 25 },
        errorReply(-32000, 'Backend unavailable'),
      );
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32000);
    });
  });

  // ── UteamupDocumentReviewAcknowledge ──────────────────────────────────

  describe('UteamupDocumentReviewAcknowledge', () => {
    it('returns ack response model on success', async () => {
      const ackPayload = {
        id: 7001,
        documentId: 1001,
        userId: 'user-A',
        userName: 'Alex',
        ackedAt: '2026-04-15T10:30:00Z',
        comment: 'Looks good',
      };
      const response = await call(
        'UteamupDocumentReviewAcknowledge',
        { documentId: 1001, comment: 'Looks good' },
        successReply(ackPayload),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.id).toBe(7001);
      expect(data.documentId).toBe(1001);
      expect(data.comment).toBe('Looks good');
    });

    it('works without an optional comment', async () => {
      const ackPayload = {
        id: 7002,
        documentId: 1002,
        userId: 'user-B',
        ackedAt: '2026-04-15T10:31:00Z',
      };
      const response = await call(
        'UteamupDocumentReviewAcknowledge',
        { documentId: 1002 },
        successReply(ackPayload),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.documentId).toBe(1002);
    });

    it('surfaces 404 from the backend (cross-tenant rejection)', async () => {
      const response = await call(
        'UteamupDocumentReviewAcknowledge',
        { documentId: 9999 },
        errorReply(-32602, 'Document not found for tenant'),
      );
      expect(response.body.error.message).toMatch(/not found/i);
    });
  });

  // ── UteamupAIUsageSummary ─────────────────────────────────────────────

  describe('UteamupAIUsageSummary', () => {
    it('returns aggregated usage grouped by provider and operation', async () => {
      const payload = {
        from: '2026-03-15T00:00:00Z',
        to: '2026-04-15T00:00:00Z',
        totalRequests: 124,
        successfulRequests: 119,
        failedRequests: 5,
        totalTokens: 856_400,
        totalCostUsdMicros: 12_345_678,
        byProvider: [
          {
            provider: 'OpenAI',
            requests: 80,
            tokens: 600_000,
            costUsdMicros: 9_000_000,
          },
          {
            provider: 'Gemini',
            requests: 44,
            tokens: 256_400,
            costUsdMicros: 3_345_678,
          },
        ],
        byOperation: [
          { operationType: 0, requests: 100, tokens: 700_000, costUsdMicros: 10_000_000 },
          { operationType: 1, requests: 24, tokens: 156_400, costUsdMicros: 2_345_678 },
        ],
      };
      const response = await call(
        'UteamupAIUsageSummary',
        { from: '2026-03-15T00:00:00Z', to: '2026-04-15T00:00:00Z' },
        successReply(payload),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.totalRequests).toBe(124);
      expect(data.byProvider).toHaveLength(2);
      expect(data.byProvider[0].provider).toBe('OpenAI');
      expect(data.byOperation[0].operationType).toBe(0); // PhotoAnalysis
    });

    it('works with default window (no from/to args)', async () => {
      const response = await call(
        'UteamupAIUsageSummary',
        {},
        successReply({
          from: '',
          to: '',
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          totalCostUsdMicros: 0,
          byProvider: [],
          byOperation: [],
        }),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.totalRequests).toBe(0);
    });
  });
});
