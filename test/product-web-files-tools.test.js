/** Product web photos and documents MCP proxy contract tests. */
'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Product web files MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_product_web_files';

  const ASSET_GUID = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const DOCUMENT_GUID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

  const searchTool = { name: 'uteamup_product_web_files_search', args: { itemKind: 'Asset', itemGuid: ASSET_GUID, query: 'Liebherr GTB 4150' } };
  const importTool = {
    name: 'uteamup_product_web_files_import',
    args: { itemKind: 'Asset', itemGuid: ASSET_GUID, url: 'https://maker.example/docs/gtb4150-manual.pdf', pageUrl: 'https://maker.example/gtb4150' },
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  const resultOf = (response) => JSON.parse(response.body.result.content[0].text);

  test('search forwards the item and query verbatim and passes photos, documents and credits through', async () => {
    const response = await call(searchTool.name, searchTool.args, successReply({
      query: 'Liebherr GTB 4150',
      images: [{ url: 'https://shop.example/gtb4150.jpg', pageUrl: 'https://shop.example/p/gtb4150', pageTitle: 'GTB 4150' }],
      documents: [{ url: 'https://maker.example/docs/gtb4150-manual.pdf', title: 'Manual', host: 'maker.example', snippet: 'Installation' }],
      warnings: [],
      creditsCharged: 25,
      creditsRemaining: 475,
    }), searchTool.args);

    const data = resultOf(response);
    expect(data.images).toHaveLength(1);
    expect(data.documents[0].host).toBe('maker.example');
    expect(data.creditsCharged).toBe(25);
  });

  test('search without a query forwards only the item', async () => {
    const args = { itemKind: 'Chemical', itemGuid: ASSET_GUID };
    const response = await call(searchTool.name, args, successReply({ query: 'Glycol', images: [], documents: [], warnings: ['No photos or documents were found'], creditsCharged: 0 }), args);

    const data = resultOf(response);
    expect(data.images).toEqual([]);
    expect(data.documents).toEqual([]);
    expect(data.creditsCharged).toBe(0);
  });

  test('passes a refused search (no Update permission) through as an error', async () => {
    const response = await call(searchTool.name, searchTool.args, errorReply(-32000, 'productwebfiles.forbidden'));
    expect(response.body.error.message).toBe('productwebfiles.forbidden');
    expect(response.body.result).toBeUndefined();
  });

  test('passes a short quota through as an error', async () => {
    const response = await call(searchTool.name, searchTool.args, errorReply(-32000, 'productwebfiles.ai-quota'));
    expect(response.body.error.message).toBe('productwebfiles.ai-quota');
  });

  test('import forwards the URL and page verbatim and passes the attached document through by GUID', async () => {
    const response = await call(importTool.name, importTool.args, successReply({
      documentGuid: DOCUMENT_GUID, fileName: 'gtb4150-manual.pdf', contentType: 'application/pdf',
      sourceUrl: importTool.args.url, attachedToItem: true,
    }), importTool.args);

    const data = resultOf(response);
    expect(data.documentGuid).toBe(DOCUMENT_GUID);
    expect(data.attachedToItem).toBe(true);
    expect(data).not.toHaveProperty('id');
  });

  test('passes a blocked URL through as an error', async () => {
    const args = { ...importTool.args, url: 'http://169.254.169.254/latest/meta-data' };
    const response = await call(importTool.name, args, errorReply(-32000, 'productwebfiles.url-blocked'), args);
    expect(response.body.error.message).toBe('productwebfiles.url-blocked');
    expect(response.body.result).toBeUndefined();
  });

  test('no tool takes a tenant or user id; identity comes from the token', () => {
    for (const tool of [searchTool, importTool]) {
      for (const key of Object.keys(tool.args)) {
        expect(key).not.toMatch(/^(tenant|user)(Id|Guid)$/i);
        expect(key).not.toMatch(/Id$/);
      }
    }
  });

  const tools = [searchTool, importTool];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
