/** Tenant Knowledge and tutorial trust MCP proxy contract tests. */
'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('tenant Knowledge and tutorial trust MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_ai_knowledge_trust';
  const tool = { name: 'UteamupAIKnowledgeTutorialTrust', args: {} };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  test('passes through Knowledge coverage, gaps and tutorial telemetry', async () => {
    const response = await call(tool.name, tool.args, successReply({
      evaluatedAtUtc: '2026-07-16T15:00:00Z',
      staleKnowledgeCutoffUtc: '2025-07-16T15:00:00Z',
      knowledge: {
        totalArticles: 20, publishedArticles: 18, freshArticles: 15,
        staleArticles: 5, contextualArticles: 14, articlesWithDocuments: 11,
        openGapCount: 16, freshnessCoveragePercent: 75,
        contextCoveragePercent: 70, documentCitationCoveragePercent: 61.11,
      },
      tutorials: {
        totalProgressRecords: 12, uniqueUsers: 8, inProgress: 3, completed: 7,
        dismissed: 1, snoozed: 1, telemetryEventsLast30Days: 42,
        failureEventsLast30Days: 2, missingTargetEventsLast30Days: 3,
        completionRatePercent: 58.33,
        eventsByPlatform: [{ key: 'web', count: 30 }],
        eventsByType: [{ key: 'complete', count: 7 }],
      },
    }));

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.knowledge.openGapCount).toBe(16);
    expect(data.knowledge.documentCitationCoveragePercent).toBe(61.11);
    expect(data.tutorials.missingTargetEventsLast30Days).toBe(3);
    expect(data.tutorials.eventsByPlatform[0].key).toBe('web');
  });

  test('passes through a valid empty-evidence assessment', async () => {
    const response = await call(tool.name, tool.args, successReply({
      evaluatedAtUtc: '2026-07-16T15:00:00Z',
      staleKnowledgeCutoffUtc: '2025-07-16T15:00:00Z',
      knowledge: { totalArticles: 0, publishedArticles: 0, openGapCount: 0 },
      tutorials: { totalProgressRecords: 0, uniqueUsers: 0, eventsByPlatform: [], eventsByType: [] },
    }));
    expect(response.status).toBe(200);
  });

  test('passes through permission denial', async () => {
    const response = await call(
      tool.name,
      tool.args,
      errorReply(-32000, 'Permission denied: AIUsage.ViewTenant required'),
    );
    expect(response.body.error.message).toMatch(/AIUsage\.ViewTenant/i);
  });

  const tools = [tool];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
