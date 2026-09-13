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

"use strict";

const nock = require("nock");
const {
  callMcpTool: _callMcpTool,
  successReply,
  errorReply,
} = require("./helpers/mcp-test-helpers");
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require("./helpers/mcp-error-tests");

describe("Document Import / Review / AI Usage MCP tools", () => {
  const BASE_URL = "https://api.test.com";
  const ACCESS_TOKEN = "test_access_token_document_import";
  const LOGBOOK_IMPORT_GUID = "77777777-7777-4777-8777-777777777777";
  const logbookImportTools = [
    {
      name: "UteamupLogbookImportGet",
      args: { logbookImportGuid: LOGBOOK_IMPORT_GUID },
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(
      BASE_URL,
      ACCESS_TOKEN,
      toolName,
      toolArgs,
      mockReply,
      expectedArgs,
    );

  // ── UteamupDocumentImportGetBatch ──────────────────────────────────────

  describe("UteamupDocumentImportGetBatch", () => {
    const batchPayload = {
      id: 42,
      tenantGuid: "11111111-1111-1111-1111-111111111111",
      title: "Turbine PM 2026-04",
      source: 1,
      status: 2,
      totalItems: 2,
      processedItems: 2,
      failedItems: 0,
      skippedAnalysisItems: 1,
      aiQuotaExhausted: true,
      createdAt: "2026-04-15T10:00:00Z",
      updatedAt: "2026-04-15T10:05:00Z",
      items: [
        {
          documentId: 1001,
          fileName: "turbine.jpg",
          contentType: "image/jpeg",
          aiAnalysisStatus: 3,
          tags: [{ tagId: 1, tagName: "turbine", isAiSuggested: true }],
          assetIds: [10],
          codeCatalogEntries: [],
          unresolvedAssetCodes: [],
        },
      ],
    };

    it("returns batch payload including aiQuotaExhausted flag", async () => {
      const response = await call(
        "UteamupDocumentImportGetBatch",
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

    it("returns null when the batch is not found", async () => {
      const response = await call(
        "UteamupDocumentImportGetBatch",
        { batchId: 9999 },
        successReply(null),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toBeNull();
    });
  });

  // ── UteamupLogbookImportGet ────────────────────────────────────────────

  describe("UteamupLogbookImportGet", () => {
    it("returns parsed logbook with entries", async () => {
      const logbookImportGuid = LOGBOOK_IMPORT_GUID;
      const sourceDocumentGuid = "99999999-9999-4999-8999-999999999999";
      const entryGuid = "50150150-1501-4501-8501-501501501501";
      const payload = {
        guid: logbookImportGuid,
        sourceDocumentGuid,
        status: 1,
        parsedEntryCount: 2,
        committedJournalCount: 0,
        entries: [
          {
            entryGuid,
            parsedDate: "2026-04-10T00:00:00Z",
            parsedHeading: "Start of shift",
            parsedBodyHtml: "<p>HVAC inspection complete</p>",
            isIgnored: false,
          },
        ],
        warnings: ["entry 502 missing heading"],
      };

      const response = await call(
        "UteamupLogbookImportGet",
        { logbookImportGuid },
        successReply(payload),
        { logbookImportGuid },
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.guid).toBe(logbookImportGuid);
      expect(data.sourceDocumentGuid).toBe(sourceDocumentGuid);
      expect(data.entries[0].entryGuid).toBe(entryGuid);
      expect(data.documentImportBatchId).toBeUndefined();
      expect(data.entries).toHaveLength(1);
      expect(data.warnings).toContain("entry 502 missing heading");
    });

    it("forwards the GUID and preserves an empty not-found result", async () => {
      const logbookImportGuid = "77777777-7777-4777-8777-777777777778";
      const response = await call(
        "UteamupLogbookImportGet",
        { logbookImportGuid },
        successReply(null),
        { logbookImportGuid },
      );

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body.result.content[0].text)).toBeNull();
    });

    it("preserves backend JSON-RPC errors", async () => {
      const logbookImportGuid = "77777777-7777-4777-8777-777777777779";
      const response = await call(
        "UteamupLogbookImportGet",
        { logbookImportGuid },
        errorReply(-32602, "Invalid logbook import GUID"),
        { logbookImportGuid },
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toMatchObject({
        code: -32602,
        message: "Invalid logbook import GUID",
      });
    });

  });

  // ── UteamupDocumentReviewQueue ─────────────────────────────────────────

  const DOCUMENT_GUID = "22222222-2222-4222-8222-222222222222";
  const VERSION_GUID = "33333333-3333-4333-8333-333333333333";
  const ACK_GUID = "44444444-4444-4444-8444-444444444444";
  const REVIEWER_GUID = "55555555-5555-4555-8555-555555555555";
  const documentStamp = "2026-09-13T10:30:00Z";
  const exactVersion = {
    documentVersionGuid: VERSION_GUID, versionNumber: 2, fileName: "drawing-v2.pdf",
    contentSha256: "a".repeat(64), contentLengthBytes: 100,
    storageCommitmentHash: "b".repeat(64), integrityVerified: true,
  };

  describe("UteamupDocumentReviewQueue", () => {
    it("preserves the exact observed version and document token with peer-review counts", async () => {
      const items = [{
        documentGuid: DOCUMENT_GUID, fileName: "drawing-v2.pdf", contentType: "application/pdf",
        sourceType: 1, aiAnalysisStatus: 3, aiDescription: "Reviewed source",
        importBatchGuid: "66666666-6666-4666-8666-666666666666", importBatchTitle: "Turbine PM",
        acknowledgmentCount: 1, effectiveReviewerThreshold: 2, createdAt: documentStamp,
        ackedByCurrentUser: false, isVersioned: true, documentUpdatedAt: documentStamp, version: exactVersion,
      }];
      const response = await call("UteamupDocumentReviewQueue", { page: 1, pageSize: 25 }, successReply(items));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0]).toEqual(items[0]);
      expect(data[0]).not.toHaveProperty("documentId");
    });

    it("passes the tenant-scoped batch GUID filter", async () => {
      const args = { page: 1, pageSize: 50, batchGuid: "66666666-6666-4666-8666-666666666666" };
      const response = await call("UteamupDocumentReviewQueue", args, successReply([]), args);
      expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
    });

    it("surfaces queue unavailability without an empty successful result", async () => {
      const response = await call("UteamupDocumentReviewQueue", { page: 1, pageSize: 25 },
        errorReply(-32000, "Backend unavailable"));
      expect(response.body.error.code).toBe(-32000);
    });
  });

  describe("UteamupDocumentReviewAcknowledge", () => {
    it("passes the exact version and observed token and retains the bound receipt", async () => {
      const args = { documentGuid: DOCUMENT_GUID, documentVersionGuid: VERSION_GUID,
        expectedDocumentUpdatedAt: documentStamp, comment: "Reviewed exact drawing" };
      const receipt = { guid: ACK_GUID, documentGuid: DOCUMENT_GUID, userGuid: REVIEWER_GUID,
        ackedAt: documentStamp, comment: args.comment, isVersionBound: true, version: exactVersion };
      const response = await call("UteamupDocumentReviewAcknowledge", args, successReply(receipt), args);
      expect(JSON.parse(response.body.result.content[0].text)).toEqual(receipt);
    });

    it("keeps a legacy unversioned receipt explicitly unbound", async () => {
      const receipt = { guid: ACK_GUID, documentGuid: DOCUMENT_GUID, userGuid: REVIEWER_GUID,
        ackedAt: documentStamp, isVersionBound: false, version: null };
      const response = await call("UteamupDocumentReviewAcknowledge", { documentGuid: DOCUMENT_GUID },
        successReply(receipt));
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.isVersionBound).toBe(false);
      expect(data.version).toBeNull();
    });

    it("preserves a stale-review conflict for the caller to refresh", async () => {
      const response = await call("UteamupDocumentReviewAcknowledge",
        { documentGuid: DOCUMENT_GUID, documentVersionGuid: VERSION_GUID, expectedDocumentUpdatedAt: documentStamp },
        errorReply(-32602, "The document review changed. Open the exact current version."));
      expect(response.body.error.message).toMatch(/review changed/i);
    });
  });

  describe("UteamupDocumentReviewAcknowledgment", () => {
    it("returns the same receipt GUID and old exact version after archival", async () => {
      const args = { documentGuid: DOCUMENT_GUID, acknowledgmentGuid: ACK_GUID };
      const receipt = { guid: ACK_GUID, documentGuid: DOCUMENT_GUID, userGuid: REVIEWER_GUID,
        ackedAt: documentStamp, isVersionBound: true, version: exactVersion,
        archivedAt: "2026-09-14T08:00:00Z", clearedOnVersionNumber: 3 };
      const response = await call("UteamupDocumentReviewAcknowledgment", args, successReply(receipt), args);
      expect(JSON.parse(response.body.result.content[0].text)).toEqual(receipt);
    });
  });

  // ── UteamupAIUsageSummary ─────────────────────────────────────────────

  describe("UteamupAIUsageSummary", () => {
    it("returns aggregated usage grouped by provider and operation", async () => {
      const payload = {
        from: "2026-03-15T00:00:00Z",
        to: "2026-04-15T00:00:00Z",
        totalRequests: 124,
        successfulRequests: 119,
        failedRequests: 5,
        totalTokens: 856_400,
        totalCostUsdMicros: 12_345_678,
        byProvider: [
          {
            provider: "OpenAI",
            requests: 80,
            tokens: 600_000,
            costUsdMicros: 9_000_000,
          },
          {
            provider: "Gemini",
            requests: 44,
            tokens: 256_400,
            costUsdMicros: 3_345_678,
          },
        ],
        byOperation: [
          {
            operationType: 0,
            requests: 100,
            tokens: 700_000,
            costUsdMicros: 10_000_000,
          },
          {
            operationType: 1,
            requests: 24,
            tokens: 156_400,
            costUsdMicros: 2_345_678,
          },
        ],
      };
      const response = await call(
        "UteamupAIUsageSummary",
        { from: "2026-03-15T00:00:00Z", to: "2026-04-15T00:00:00Z" },
        successReply(payload),
      );
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.totalRequests).toBe(124);
      expect(data.byProvider).toHaveLength(2);
      expect(data.byProvider[0].provider).toBe("OpenAI");
      expect(data.byOperation[0].operationType).toBe(0); // PhotoAnalysis
    });

    it("works with default window (no from/to args)", async () => {
      const response = await call(
        "UteamupAIUsageSummary",
        {},
        successReply({
          from: "",
          to: "",
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

  describeJsonRpcCompliance(call, logbookImportTools);
  describe401Unauthorized(BASE_URL, logbookImportTools);
  describe503ServiceUnavailable(BASE_URL, logbookImportTools);
});
