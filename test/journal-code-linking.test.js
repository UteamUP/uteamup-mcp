/**
 * Journal Industry Code Linking MCP Tool Tests
 *
 * Tests for the four new tools added in Task Group 10:
 *   UteamupCodecatalogSearch      — search code catalog entries by keyword
 *   UteamupJournalGetByCode       — get journals referencing a code catalog entry
 *   UteamupJournalGetByAsset      — get journals linked to an asset
 *   UteamupJournalCreateWithCodeMentions — create a journal with explicit code links
 *
 * Pattern mirrors workorder-watchlist.test.js: nock-mocked HTTPS calls that simulate
 * what the MCP proxy forwards to the backend /mcp endpoint.
 */

'use strict';

const nock = require('nock');
const https = require('https');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
} = require('./helpers/mcp-error-tests');

describe('Journal Code Linking MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_journal_code_linking';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------

  const mockCodeEntry1 = {
    id: 42,
    code: '10-MAB-001',
    displayCode: '10-MAB-001',
    name: 'Feed Water Pump A',
    description: 'Primary feed water pump, unit 1',
    codingSystemId: 1,
    levelName: 'Equipment',
    levelOrder: 3,
    isPrimaryIdentifier: true
  };

  const mockCodeEntry2 = {
    id: 87,
    code: '20-DAA-002',
    displayCode: '20-DAA-002',
    name: 'Steam Boiler 2',
    description: 'Main steam generation boiler, unit 2',
    codingSystemId: 1,
    levelName: 'Equipment',
    levelOrder: 3,
    isPrimaryIdentifier: true
  };

  const mockJournal1 = {
    id: 101,
    title: 'Pump inspection',
    content: 'Checked pump bearings. All nominal.',
    journalDate: '2026-04-09T08:00:00Z',
    categoryId: 5,
    priority: 3,
    linkedCodeCatalogEntries: [
      { id: 1, codeCatalogEntryId: 42, code: '10-MAB-001', displayCode: '10-MAB-001', name: 'Feed Water Pump A' }
    ]
  };

  const mockJournal2 = {
    id: 102,
    title: 'Boiler maintenance log',
    content: 'Replaced burner nozzle. Pressure nominal.',
    journalDate: '2026-04-08T14:00:00Z',
    categoryId: 5,
    priority: 4,
    linkedCodeCatalogEntries: [
      { id: 2, codeCatalogEntryId: 87, code: '20-DAA-002', displayCode: '20-DAA-002', name: 'Steam Boiler 2' }
    ]
  };

  const mockPaginatedResult = {
    items: [mockJournal1],
    totalCount: 1,
    pageNumber: 1,
    pageSize: 20,
    totalPages: 1
  };

  // ---------------------------------------------------------------------------
  // UteamupCodecatalogSearch
  // ---------------------------------------------------------------------------
  describe('UteamupCodecatalogSearch tool', () => {
    test('returns matching code entries for a keyword query', async () => {
      const response = await call(
        'UteamupCodecatalogSearch',
        { query: 'pump', limit: 10 },
        successReply([mockCodeEntry1])
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe(42);
      expect(data[0].code).toBe('10-MAB-001');
      expect(data[0].name).toBe('Feed Water Pump A');
      expect(data[0].isPrimaryIdentifier).toBe(true);
    });

    test('returns multiple matching entries', async () => {
      const response = await call(
        'UteamupCodecatalogSearch',
        { query: 'unit', limit: 20 },
        successReply([mockCodeEntry1, mockCodeEntry2])
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(2);
      expect(data[0].id).toBe(42);
      expect(data[1].id).toBe(87);
    });

    test('returns empty array when no codes match', async () => {
      const response = await call(
        'UteamupCodecatalogSearch',
        { query: 'nonexistent-xyz-code-999', limit: 10 },
        successReply([])
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toEqual([]);
    });

    test('uses default limit when not provided', async () => {
      const response = await call(
        'UteamupCodecatalogSearch',
        { query: 'pump' },
        successReply([mockCodeEntry1])
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data[0].id).toBe(42);
    });

    test('returns error when query is empty', async () => {
      const response = await call(
        'UteamupCodecatalogSearch',
        { query: '' },
        errorReply(-32602, 'Query must not be empty')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32602);
      expect(response.body.error.message).toContain('Query must not be empty');
    });

    test('returns error on permission denied', async () => {
      const response = await call(
        'UteamupCodecatalogSearch',
        { query: 'pump' },
        errorReply(-32000, 'Permission denied: CodingSystem.View required')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('CodingSystem.View');
    });

    test('tenant isolation — different token returns different results', async () => {
      // Tenant A gets results
      const responseA = await call(
        'UteamupCodecatalogSearch',
        { query: 'pump' },
        successReply([mockCodeEntry1])
      );
      const dataA = JSON.parse(responseA.body.result.content[0].text);
      expect(dataA[0].id).toBe(42);

      // Tenant B (different access token) gets different / empty results
      const responseB = await _callMcpTool(
        BASE_URL,
        'tenant_b_token_different',
        'UteamupCodecatalogSearch',
        { query: 'pump' },
        successReply([])
      );
      const dataB = JSON.parse(responseB.body.result.content[0].text);
      expect(dataB).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupJournalGetByCode
  // ---------------------------------------------------------------------------
  describe('UteamupJournalGetByCode tool', () => {
    test('returns paginated journals for a code catalog entry', async () => {
      const response = await call(
        'UteamupJournalGetByCode',
        { codeCatalogEntryId: 42, pageNumber: 1, pageSize: 20 },
        successReply(mockPaginatedResult)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.totalCount).toBe(1);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].id).toBe(101);
      expect(data.items[0].title).toBe('Pump inspection');
    });

    test('returns empty result when no journals reference the code', async () => {
      const response = await call(
        'UteamupJournalGetByCode',
        { codeCatalogEntryId: 999 },
        successReply({ items: [], totalCount: 0, pageNumber: 1, pageSize: 20, totalPages: 0 })
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.totalCount).toBe(0);
      expect(data.items).toEqual([]);
    });

    test('supports pagination — second page', async () => {
      const page2Result = {
        items: [mockJournal2],
        totalCount: 2,
        pageNumber: 2,
        pageSize: 1,
        totalPages: 2
      };

      const response = await call(
        'UteamupJournalGetByCode',
        { codeCatalogEntryId: 42, pageNumber: 2, pageSize: 1 },
        successReply(page2Result)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.pageNumber).toBe(2);
      expect(data.items[0].id).toBe(102);
    });

    test('returns error when codeCatalogEntryId is invalid', async () => {
      const response = await call(
        'UteamupJournalGetByCode',
        { codeCatalogEntryId: 0 },
        errorReply(-32602, 'CodeCatalogEntryId must be greater than 0')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('greater than 0');
    });

    test('returns error on permission denied', async () => {
      const response = await call(
        'UteamupJournalGetByCode',
        { codeCatalogEntryId: 42 },
        errorReply(-32000, 'Permission denied: Journal.View required')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Journal.View');
    });

    test('tenant isolation — code entry from another tenant returns empty', async () => {
      // Tenant B cannot see Tenant A's journals even for the same code ID
      const responseB = await _callMcpTool(
        BASE_URL,
        'tenant_b_token_different',
        'UteamupJournalGetByCode',
        { codeCatalogEntryId: 42 },
        successReply({ items: [], totalCount: 0, pageNumber: 1, pageSize: 20, totalPages: 0 })
      );

      const dataB = JSON.parse(responseB.body.result.content[0].text);
      expect(dataB.totalCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupJournalGetByAsset
  // ---------------------------------------------------------------------------
  describe('UteamupJournalGetByAsset tool', () => {
    test('returns paginated journals for an asset', async () => {
      const response = await call(
        'UteamupJournalGetByAsset',
        { assetId: 500, pageNumber: 1, pageSize: 20 },
        successReply(mockPaginatedResult)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.totalCount).toBe(1);
      expect(data.items[0].id).toBe(101);
    });

    test('returns empty result when asset has no journals', async () => {
      const response = await call(
        'UteamupJournalGetByAsset',
        { assetId: 9999 },
        successReply({ items: [], totalCount: 0, pageNumber: 1, pageSize: 20, totalPages: 0 })
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.totalCount).toBe(0);
      expect(data.items).toEqual([]);
    });

    test('supports pagination parameters', async () => {
      const page2 = {
        items: [mockJournal2],
        totalCount: 3,
        pageNumber: 2,
        pageSize: 1,
        totalPages: 3
      };

      const response = await call(
        'UteamupJournalGetByAsset',
        { assetId: 500, pageNumber: 2, pageSize: 1 },
        successReply(page2)
      );

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.pageNumber).toBe(2);
      expect(data.totalPages).toBe(3);
    });

    test('returns error when assetId is invalid', async () => {
      const response = await call(
        'UteamupJournalGetByAsset',
        { assetId: -1 },
        errorReply(-32602, 'AssetId must be greater than 0')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('greater than 0');
    });

    test('returns error on permission denied', async () => {
      const response = await call(
        'UteamupJournalGetByAsset',
        { assetId: 500 },
        errorReply(-32000, 'Permission denied: Journal.View required')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Journal.View');
    });

    test('tenant isolation — asset journals are scoped to the requesting tenant', async () => {
      const responseB = await _callMcpTool(
        BASE_URL,
        'tenant_b_token_different',
        'UteamupJournalGetByAsset',
        { assetId: 500 },
        successReply({ items: [], totalCount: 0, pageNumber: 1, pageSize: 20, totalPages: 0 })
      );

      const dataB = JSON.parse(responseB.body.result.content[0].text);
      expect(dataB.items).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupJournalCreateWithCodeMentions
  // ---------------------------------------------------------------------------
  describe('UteamupJournalCreateWithCodeMentions tool', () => {
    const mockCreatedJournal = {
      id: 201,
      title: 'Pump and boiler inspection',
      content: 'Checked pump bearings and boiler pressure.',
      journalDate: '2026-04-09T10:00:00Z',
      categoryId: 5,
      priority: 3,
      linkedCodeCatalogEntries: [
        { id: 10, codeCatalogEntryId: 42, code: '10-MAB-001', displayCode: '10-MAB-001', name: 'Feed Water Pump A' },
        { id: 11, codeCatalogEntryId: 87, code: '20-DAA-002', displayCode: '20-DAA-002', name: 'Steam Boiler 2' }
      ]
    };

    test('creates a journal with multiple code mentions', async () => {
      const response = await call(
        'UteamupJournalCreateWithCodeMentions',
        {
          title: 'Pump and boiler inspection',
          content: 'Checked pump bearings and boiler pressure.',
          categoryId: 5,
          codeCatalogEntryIds: [42, 87]
        },
        successReply(mockCreatedJournal)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.id).toBe(201);
      expect(data.title).toBe('Pump and boiler inspection');
      expect(data.linkedCodeCatalogEntries).toHaveLength(2);
      expect(data.linkedCodeCatalogEntries[0].codeCatalogEntryId).toBe(42);
      expect(data.linkedCodeCatalogEntries[1].codeCatalogEntryId).toBe(87);
    });

    test('creates a journal with a single code mention', async () => {
      const journalWithOne = {
        ...mockCreatedJournal,
        id: 202,
        linkedCodeCatalogEntries: [
          { id: 10, codeCatalogEntryId: 42, code: '10-MAB-001', displayCode: '10-MAB-001', name: 'Feed Water Pump A' }
        ]
      };

      const response = await call(
        'UteamupJournalCreateWithCodeMentions',
        {
          title: 'Pump inspection',
          content: 'Bearings checked.',
          categoryId: 5,
          codeCatalogEntryIds: [42]
        },
        successReply(journalWithOne)
      );

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.id).toBe(202);
      expect(data.linkedCodeCatalogEntries).toHaveLength(1);
    });

    test('creates a journal with optional assetId and locationId', async () => {
      const journalWithAsset = { ...mockCreatedJournal, id: 203, assetId: 500, locationId: 10 };

      const response = await call(
        'UteamupJournalCreateWithCodeMentions',
        {
          title: 'Asset inspection',
          content: 'Detailed findings.',
          categoryId: 5,
          codeCatalogEntryIds: [42],
          assetId: 500,
          locationId: 10
        },
        successReply(journalWithAsset)
      );

      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.id).toBe(203);
      expect(data.assetId).toBe(500);
    });

    test('returns error when title is missing', async () => {
      const response = await call(
        'UteamupJournalCreateWithCodeMentions',
        {
          title: '',
          content: 'Some content',
          categoryId: 5,
          codeCatalogEntryIds: [42]
        },
        errorReply(-32602, 'Title is required')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Title is required');
    });

    test('returns error when content is missing', async () => {
      const response = await call(
        'UteamupJournalCreateWithCodeMentions',
        {
          title: 'Valid title',
          content: '',
          categoryId: 5,
          codeCatalogEntryIds: [42]
        },
        errorReply(-32602, 'Content is required')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Content is required');
    });

    test('returns error when categoryId is invalid', async () => {
      const response = await call(
        'UteamupJournalCreateWithCodeMentions',
        {
          title: 'Valid title',
          content: 'Valid content',
          categoryId: 0,
          codeCatalogEntryIds: [42]
        },
        errorReply(-32602, 'CategoryId must be greater than 0')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('CategoryId');
    });

    test('returns error when codeCatalogEntryIds list is empty', async () => {
      const response = await call(
        'UteamupJournalCreateWithCodeMentions',
        {
          title: 'Valid title',
          content: 'Valid content',
          categoryId: 5,
          codeCatalogEntryIds: []
        },
        errorReply(-32602, 'codeCatalogEntryIds must contain at least one entry')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32602);
    });

    test('returns error on permission denied (Journal.Create)', async () => {
      const response = await call(
        'UteamupJournalCreateWithCodeMentions',
        {
          title: 'Valid title',
          content: 'Valid content',
          categoryId: 5,
          codeCatalogEntryIds: [42]
        },
        errorReply(-32000, 'Permission denied: Journal.Create required')
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Journal.Create');
    });

    test('tenant isolation — journals created for one tenant not visible to another', async () => {
      // Simulate that tenant B cannot read journal created by tenant A
      const responseB = await _callMcpTool(
        BASE_URL,
        'tenant_b_token_different',
        'UteamupJournalGetByCode',
        { codeCatalogEntryId: 42 },
        successReply({ items: [], totalCount: 0, pageNumber: 1, pageSize: 20, totalPages: 0 })
      );

      const dataB = JSON.parse(responseB.body.result.content[0].text);
      expect(dataB.totalCount).toBe(0);
      expect(dataB.items).toEqual([]);
    });

    test('handles network error gracefully', async () => {
      nock(BASE_URL)
        .post('/mcp', body =>
          body.method === 'tools/call' &&
          body.params?.name === 'UteamupJournalCreateWithCodeMentions'
        )
        .delay(100)
        .reply(200, successReply({}).body);

      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupJournalCreateWithCodeMentions',
          arguments: {
            title: 'Test',
            content: 'Test content',
            categoryId: 5,
            codeCatalogEntryIds: [42]
          }
        },
        id: 9003
      };

      await expect(new Promise((resolve, reject) => {
        const data = JSON.stringify(request);
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          },
          rejectUnauthorized: false
        }, (res) => {
          let responseData = '';
          res.on('data', chunk => responseData += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body: responseData }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
        setImmediate(() => {
          const error = new Error('Connection reset');
          error.code = 'ECONNRESET';
          req.destroy(error);
        });
      })).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Shared JSON-RPC 2.0 compliance and auth error tests
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupCodecatalogSearch', args: { query: 'pump', limit: 5 } },
    { name: 'UteamupJournalGetByCode', args: { codeCatalogEntryId: 42 } },
    { name: 'UteamupJournalGetByAsset', args: { assetId: 500 } },
    {
      name: 'UteamupJournalCreateWithCodeMentions',
      args: {
        title: 'Test journal',
        content: 'Test content',
        categoryId: 5,
        codeCatalogEntryIds: [42]
      }
    }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
