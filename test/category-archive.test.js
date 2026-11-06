/**
 * UteamupCategoryArchive and UteamupCategoryRestore MCP tool tests.
 *
 * Backend tools: ArchiveCategoryCommand / RestoreCategoryCommand + CategoryArchiveCommandHandler.
 * A category in use cannot be deleted (it would cascade into stock and labour history), so it is archived:
 * it leaves lists, searches, pickers and synced phones and stays on every record that uses it. Restore
 * brings it back. Both need Category.Delete.
 *
 * Generic-proxy pattern (nock-mocked backend; no real network).
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Category archive MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_category_archive';

  const CATEGORY = 'cccccccc-0000-4000-8000-000000000001';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (tool, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, tool, toolArgs, mockReply);

  it('archives a category and returns when it was archived', async () => {
    const response = await call(
      'UteamupCategoryArchive',
      { categoryGuid: CATEGORY },
      successReply({ guid: CATEGORY, name: 'Electrical', archivedAtUtc: '2026-11-06T12:00:00Z' }),
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.guid).toBe(CATEGORY);
    expect(data.archivedAtUtc).toBeTruthy();
  });

  it('restores an archived category', async () => {
    const response = await call(
      'UteamupCategoryRestore',
      { categoryGuid: CATEGORY },
      successReply({ guid: CATEGORY, name: 'Electrical', archivedAtUtc: null }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.guid).toBe(CATEGORY);
    expect(data.archivedAtUtc).toBeNull();
  });

  it('surfaces a missing Category.Delete right as a JSON-RPC error', async () => {
    const response = await call(
      'UteamupCategoryArchive',
      { categoryGuid: CATEGORY },
      errorReply(-32000, 'Permission denied: Category.Delete required'),
    );

    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/Category\.Delete/);
  });

  it('surfaces a category outside the tenant as not_found', async () => {
    const response = await call(
      'UteamupCategoryRestore',
      { categoryGuid: CATEGORY },
      errorReply(-32000, 'not_found: Category unavailable.'),
    );

    expect(response.body.error.message).toMatch(/not_found/);
  });

  it('surfaces a concurrent change as category_changed', async () => {
    const response = await call(
      'UteamupCategoryArchive',
      { categoryGuid: CATEGORY },
      errorReply(-32000, 'category_changed: The category changed; read it again and retry.'),
    );

    expect(response.body.error.message).toMatch(/category_changed/);
  });

  const errorTools = [
    { name: 'UteamupCategoryArchive', args: { categoryGuid: CATEGORY } },
    { name: 'UteamupCategoryRestore', args: { categoryGuid: CATEGORY } },
  ];
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
