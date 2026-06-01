/**
 * UteamupAssetGetAggregatedDocuments MCP tool test.
 *
 * Backend tool: GetAssetAggregatedDocumentsCommand + Handler — returns the asset's
 * own documents plus the documents of its assigned parts, tools, chemicals, and
 * industry code(s), grouped by source. Generic-proxy pattern (nock-mocked backend;
 * no real network).
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

describe('UteamupAssetGetAggregatedDocuments MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_asset_aggregated_documents';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, 'UteamupAssetGetAggregatedDocuments', toolArgs, mockReply);

  const sampleResponse = {
    assetDocuments: [
      {
        sourceType: 'Asset',
        sourceGuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        sourceName: 'SEL-751 Protection Relay',
        document: { fileName: 'asset-manual.pdf', url: 'https://blob/uteamup/asset-manual.pdf' },
      },
    ],
    partDocuments: [
      {
        sourceType: 'Part',
        sourceGuid: 'p1111111-1111-1111-1111-111111111111',
        sourceName: 'Relay Module',
        document: { fileName: 'part-datasheet.pdf', url: 'https://blob/uteamup/part-datasheet.pdf' },
      },
    ],
    toolDocuments: [],
    chemicalDocuments: [],
    otherDocuments: [
      {
        sourceType: 'Other',
        sourceGuid: 'c1111111-1111-1111-1111-111111111111',
        sourceName: '0AKA11',
        document: { fileName: 'code-drawing.pdf', url: 'https://blob/uteamup/code-drawing.pdf' },
      },
    ],
  };

  it('returns documents grouped by source, each tagged with provenance', async () => {
    const response = await call(
      { assetGuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
      successReply(sampleResponse),
    );
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(Array.isArray(data.assetDocuments)).toBe(true);
    expect(Array.isArray(data.partDocuments)).toBe(true);
    expect(Array.isArray(data.toolDocuments)).toBe(true);
    expect(Array.isArray(data.chemicalDocuments)).toBe(true);
    expect(Array.isArray(data.otherDocuments)).toBe(true);

    expect(data.assetDocuments[0].sourceType).toBe('Asset');
    expect(data.assetDocuments[0].sourceName).toBe('SEL-751 Protection Relay');
    expect(data.assetDocuments[0].document.url).toContain('asset-manual.pdf');

    expect(data.partDocuments[0].sourceType).toBe('Part');
    expect(data.partDocuments[0].sourceGuid).toBe('p1111111-1111-1111-1111-111111111111');
    expect(data.otherDocuments[0].sourceType).toBe('Other');
  });

  it('returns empty (non-null) groups for an asset with no documents anywhere', async () => {
    const response = await call(
      { assetGuid: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },
      successReply({
        assetDocuments: [],
        partDocuments: [],
        toolDocuments: [],
        chemicalDocuments: [],
        otherDocuments: [],
      }),
    );
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.assetDocuments).toEqual([]);
    expect(data.partDocuments).toEqual([]);
    expect(data.toolDocuments).toEqual([]);
    expect(data.chemicalDocuments).toEqual([]);
    expect(data.otherDocuments).toEqual([]);
  });

  it('surfaces backend permission-denied as a JSON-RPC error', async () => {
    const response = await call(
      { assetGuid: 'cccccccc-cccc-cccc-cccc-cccccccccccc' },
      errorReply(-32000, 'Permission denied: Asset.View, Part.View, Tool.View, or Chemical.View required'),
    );
    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/Permission denied/i);
  });

  const errorTools = [
    {
      name: 'UteamupAssetGetAggregatedDocuments',
      args: { assetGuid: 'dddddddd-dddd-dddd-dddd-dddddddddddd' },
    },
  ];
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
