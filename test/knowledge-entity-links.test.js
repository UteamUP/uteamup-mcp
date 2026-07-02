/**
 * Knowledge Article entity-linking MCP tool tests
 *
 * Tests that the entity-linking MCP tool calls are correctly formed as
 * JSON-RPC 2.0 requests and that the MCP proxy properly handles both
 * successful and error responses from the backend /mcp endpoint.
 *
 * Tools under test (all identifiers are GUIDs — never integer ids):
 *   UteamupKnowledgeArticleGetLinked(entityType, entityGuid)
 *   UteamupKnowledgeArticleLinkEntity(entityType, entityGuid, articleGuid)
 *   UteamupKnowledgeArticleUnlinkEntity(entityType, entityGuid, articleGuid)
 *
 * Supported entity types: asset, part, tool, chemical, location,
 * workorder, workordertemplate, industrycode.
 *
 * Pattern mirrors labour-rate.test.js: raw nock-mocked HTTPS calls that
 * simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const https = require('https');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Knowledge Article Entity-Linking MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_knowledge_links';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  /**
   * Like callMcpTool, but also captures the forwarded params.arguments so
   * tests can assert the args round-trip verbatim (GUIDs untouched, no
   * injected fields).
   */
  function callWithArgCapture(toolName, toolArgs, mockReply) {
    const captured = {};
    nock(BASE_URL)
      .post('/mcp', body => {
        if (body.method === 'tools/call' && body.params?.name === toolName) {
          captured.args = body.params.arguments;
          return true;
        }
        return false;
      })
      .reply(mockReply.status, JSON.stringify(mockReply.body), { 'Content-Type': 'application/json' });

    const request = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: toolArgs },
      id: Math.floor(Math.random() * 10000)
    };

    return new Promise((resolve, reject) => {
      const data = JSON.stringify(request);
      const req = https.request(`${BASE_URL}/mcp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Content-Length': Buffer.byteLength(data)
        },
        rejectUnauthorized: false
      }, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(responseData), capturedArgs: captured.args });
          } catch {
            resolve({ status: res.statusCode, body: responseData, capturedArgs: captured.args });
          }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------
  const entityGuid = 'b1f7a2c4-8d3e-4f5a-9b6c-7d8e9f0a1b2c';
  const articleGuid = 'c2e8b3d5-9e4f-5a6b-8c7d-6e5f4a3b2c1d';

  const linkedArticles = [
    {
      id: 1,
      externalGuid: articleGuid,
      title: 'Pump Maintenance Procedure',
      slug: 'pump-maintenance-procedure',
      articleType: 1,
      status: 2,
      iconName: 'WrenchScrewdriverIcon'
    },
    {
      id: 2,
      externalGuid: 'd3f9c4e6-0f5a-6b7c-9d8e-5f4a3b2c1d0e',
      title: 'Pump Troubleshooting Guide',
      slug: 'pump-troubleshooting-guide',
      articleType: 2,
      status: 2,
      iconName: 'ExclamationTriangleIcon'
    }
  ];

  // ---------------------------------------------------------------------------
  // UteamupKnowledgeArticleGetLinked
  // ---------------------------------------------------------------------------
  describe('UteamupKnowledgeArticleGetLinked tool', () => {
    test('returns articles linked to an asset', async () => {
      const response = await call(
        'UteamupKnowledgeArticleGetLinked',
        { entityType: 'asset', entityGuid },
        successReply(linkedArticles)
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();

      const articles = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(articles)).toBe(true);
      expect(articles).toHaveLength(2);
      expect(articles[0].externalGuid).toBe(articleGuid);
      expect(articles[0].title).toBe('Pump Maintenance Procedure');
    });

    test('returns empty array when the entity has no linked articles', async () => {
      const response = await call(
        'UteamupKnowledgeArticleGetLinked',
        { entityType: 'workordertemplate', entityGuid },
        successReply([])
      );

      expect(response.status).toBe(200);
      const articles = JSON.parse(response.body.result.content[0].text);
      expect(articles).toEqual([]);
    });

    test('forwards entityType and entityGuid verbatim — GUID-only, no userId/tenantId injected', async () => {
      const response = await callWithArgCapture(
        'UteamupKnowledgeArticleGetLinked',
        { entityType: 'industrycode', entityGuid },
        successReply([])
      );

      expect(response.status).toBe(200);
      expect(response.capturedArgs).toEqual({ entityType: 'industrycode', entityGuid });
      // Regression guard: identity + tenant come from the Bearer token.
      // A userId/tenantId arg on these tools would silently invite spoofing.
      expect(Object.keys(response.capturedArgs)).toEqual(['entityType', 'entityGuid']);
    });

    test('returns validation error for an unsupported entity type', async () => {
      const response = await call(
        'UteamupKnowledgeArticleGetLinked',
        { entityType: 'spaceship', entityGuid },
        errorReply(-32602, "Unsupported entity type 'spaceship'")
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('spaceship');
    });

    test('returns error when KnowledgeArticle.View permission is missing', async () => {
      const response = await call(
        'UteamupKnowledgeArticleGetLinked',
        { entityType: 'asset', entityGuid },
        errorReply(-32000, 'Permission denied: KnowledgeArticle.View required')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('KnowledgeArticle.View');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupKnowledgeArticleLinkEntity
  // ---------------------------------------------------------------------------
  describe('UteamupKnowledgeArticleLinkEntity tool', () => {
    test('links an article to an entity and returns true', async () => {
      const response = await call(
        'UteamupKnowledgeArticleLinkEntity',
        { entityType: 'asset', entityGuid, articleGuid },
        successReply(true)
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      expect(JSON.parse(response.body.result.content[0].text)).toBe(true);
    });

    test('returns false when the entity or article is not found in the tenant', async () => {
      const response = await call(
        'UteamupKnowledgeArticleLinkEntity',
        { entityType: 'part', entityGuid, articleGuid },
        successReply(false)
      );

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body.result.content[0].text)).toBe(false);
    });

    test('forwards all three args verbatim — GUID-only, no userId/tenantId injected', async () => {
      const response = await callWithArgCapture(
        'UteamupKnowledgeArticleLinkEntity',
        { entityType: 'chemical', entityGuid, articleGuid },
        successReply(true)
      );

      expect(response.status).toBe(200);
      expect(response.capturedArgs).toEqual({ entityType: 'chemical', entityGuid, articleGuid });
      expect(Object.keys(response.capturedArgs).sort()).toEqual(['articleGuid', 'entityGuid', 'entityType']);
    });

    test('returns validation error for an unsupported entity type', async () => {
      const response = await call(
        'UteamupKnowledgeArticleLinkEntity',
        { entityType: 'spaceship', entityGuid, articleGuid },
        errorReply(-32602, "Unsupported entity type 'spaceship'")
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('spaceship');
    });

    test('returns error when KnowledgeArticle.Update permission is missing', async () => {
      const response = await call(
        'UteamupKnowledgeArticleLinkEntity',
        { entityType: 'asset', entityGuid, articleGuid },
        errorReply(-32000, 'Permission denied: KnowledgeArticle.Update required')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('KnowledgeArticle.Update');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupKnowledgeArticleUnlinkEntity
  // ---------------------------------------------------------------------------
  describe('UteamupKnowledgeArticleUnlinkEntity tool', () => {
    test('unlinks an article from an entity and returns true', async () => {
      const response = await call(
        'UteamupKnowledgeArticleUnlinkEntity',
        { entityType: 'asset', entityGuid, articleGuid },
        successReply(true)
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      expect(JSON.parse(response.body.result.content[0].text)).toBe(true);
    });

    test('returns false when no link existed (idempotent)', async () => {
      const response = await call(
        'UteamupKnowledgeArticleUnlinkEntity',
        { entityType: 'location', entityGuid, articleGuid },
        successReply(false)
      );

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body.result.content[0].text)).toBe(false);
    });

    test('forwards all three args verbatim — GUID-only, no userId/tenantId injected', async () => {
      const response = await callWithArgCapture(
        'UteamupKnowledgeArticleUnlinkEntity',
        { entityType: 'workorder', entityGuid, articleGuid },
        successReply(true)
      );

      expect(response.status).toBe(200);
      expect(response.capturedArgs).toEqual({ entityType: 'workorder', entityGuid, articleGuid });
      expect(Object.keys(response.capturedArgs).sort()).toEqual(['articleGuid', 'entityGuid', 'entityType']);
    });

    test('returns validation error for an unsupported entity type', async () => {
      const response = await call(
        'UteamupKnowledgeArticleUnlinkEntity',
        { entityType: 'spaceship', entityGuid, articleGuid },
        errorReply(-32602, "Unsupported entity type 'spaceship'")
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('spaceship');
    });

    test('returns error when KnowledgeArticle.Update permission is missing', async () => {
      const response = await call(
        'UteamupKnowledgeArticleUnlinkEntity',
        { entityType: 'asset', entityGuid, articleGuid },
        errorReply(-32000, 'Permission denied: KnowledgeArticle.Update required')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('KnowledgeArticle.Update');
    });
  });

  // ---------------------------------------------------------------------------
  // Shared error-handling tests (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupKnowledgeArticleGetLinked', args: { entityType: 'asset', entityGuid } },
    { name: 'UteamupKnowledgeArticleLinkEntity', args: { entityType: 'asset', entityGuid, articleGuid } },
    { name: 'UteamupKnowledgeArticleUnlinkEntity', args: { entityType: 'asset', entityGuid, articleGuid } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
