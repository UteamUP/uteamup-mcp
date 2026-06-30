/**
 * Knowledge AI (UPMate) MCP tool tests
 *
 * Tests that Knowledge AI MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error
 * responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   UteamupKnowledgeAiTranslate(articleGuid, targetLanguages)
 *   UteamupKnowledgeAiGenerateFromText(request)
 *
 * NOTE: file-based generation (upmate-generate/documents) is intentionally NOT an MCP tool —
 * it needs multipart file upload, which the JSON-RPC MCP channel cannot carry. It stays HTTP-only.
 *
 * Pattern mirrors maintenance-analytics-tools.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy would forward to the backend. All identifiers are GUIDs.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Knowledge AI (UPMate) MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_knowledgeai';
  const ARTICLE_GUID = '7f23c354-1a2b-4c3d-9e8f-0a1b2c3d4e5f';
  const SPACE_GUID = '3e1cd135-07d1-46ff-8f5f-549da5390e78';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------
  const mockTranslateResult = {
    content: '<en>Pump procedure</en><is>Dæluferli</is>',
    translatedLanguages: ['is'],
    creditsCharged: 1,
    remaining: 99,
    warnings: [],
    error: null,
    quotaBlockedReason: null
  };

  const mockGenerateResult = {
    articleGuid: ARTICLE_GUID,
    title: 'Generated Maintenance Guide',
    content: '<en>Generated body</en>',
    creditsCharged: 1,
    remaining: 98,
    warnings: [],
    error: null,
    quotaBlockedReason: null
  };

  // ---------------------------------------------------------------------------
  // UteamupKnowledgeAiTranslate
  // ---------------------------------------------------------------------------
  describe('UteamupKnowledgeAiTranslate tool', () => {
    test('translates a page successfully', async () => {
      const response = await call(
        'UteamupKnowledgeAiTranslate',
        { articleGuid: ARTICLE_GUID, targetLanguages: ['is'] },
        successReply(mockTranslateResult)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.translatedLanguages).toEqual(['is']);
      expect(data.creditsCharged).toBe(1);
      expect(data.remaining).toBe(99);
      expect(data.content).toContain('<is>');
    });

    test('translates into multiple languages', async () => {
      const response = await call(
        'UteamupKnowledgeAiTranslate',
        { articleGuid: ARTICLE_GUID, targetLanguages: ['is', 'pl', 'de'] },
        successReply({ ...mockTranslateResult, translatedLanguages: ['is', 'pl', 'de'], creditsCharged: 3, remaining: 97 })
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.translatedLanguages).toHaveLength(3);
      expect(data.creditsCharged).toBe(3);
    });

    test('surfaces quota-blocked result (not a throw)', async () => {
      const response = await call(
        'UteamupKnowledgeAiTranslate',
        { articleGuid: ARTICLE_GUID, targetLanguages: ['es'] },
        successReply({ ...mockTranslateResult, translatedLanguages: [], creditsCharged: 0, remaining: 0, quotaBlockedReason: 'ai_quota_exceeded' })
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.quotaBlockedReason).toBe('ai_quota_exceeded');
      expect(data.translatedLanguages).toEqual([]);
    });

    test('returns error when page not found', async () => {
      const response = await call(
        'UteamupKnowledgeAiTranslate',
        { articleGuid: ARTICLE_GUID, targetLanguages: ['is'] },
        errorReply(-32000, 'Knowledge page not found')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupKnowledgeAiGenerateFromText
  // ---------------------------------------------------------------------------
  describe('UteamupKnowledgeAiGenerateFromText tool', () => {
    test('generates a draft page from text successfully', async () => {
      const response = await call(
        'UteamupKnowledgeAiGenerateFromText',
        { request: { spaceGuid: SPACE_GUID, text: 'Replace the pump seal every 6 months.' } },
        successReply(mockGenerateResult)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.articleGuid).toBe(ARTICLE_GUID);
      expect(data.title).toBe('Generated Maintenance Guide');
      expect(data.creditsCharged).toBe(1);
      expect(data.remaining).toBe(98);
    });

    test('generates a draft page under a parent page', async () => {
      const response = await call(
        'UteamupKnowledgeAiGenerateFromText',
        { request: { spaceGuid: SPACE_GUID, text: 'Sub-procedure body.', parentArticleGuid: ARTICLE_GUID } },
        successReply(mockGenerateResult)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.articleGuid).toBe(ARTICLE_GUID);
    });

    test('surfaces quota-blocked result (not a throw)', async () => {
      const response = await call(
        'UteamupKnowledgeAiGenerateFromText',
        { request: { spaceGuid: SPACE_GUID, text: 'Body' } },
        successReply({ ...mockGenerateResult, articleGuid: null, creditsCharged: 0, remaining: 0, quotaBlockedReason: 'ai_quota_exceeded' })
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.quotaBlockedReason).toBe('ai_quota_exceeded');
      expect(data.articleGuid).toBeNull();
    });

    test('returns error when permission denied', async () => {
      const response = await call(
        'UteamupKnowledgeAiGenerateFromText',
        { request: { spaceGuid: SPACE_GUID, text: 'Body' } },
        errorReply(-32000, 'Permission denied: KnowledgeArticle.Create required')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
    });
  });

  // ---------------------------------------------------------------------------
  // Shared error-handling tests (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupKnowledgeAiTranslate', args: { articleGuid: ARTICLE_GUID, targetLanguages: ['is'] } },
    { name: 'UteamupKnowledgeAiGenerateFromText', args: { request: { spaceGuid: SPACE_GUID, text: 'Body' } } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
