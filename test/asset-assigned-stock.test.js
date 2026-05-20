/**
 * UteamupAssetGetAssignedStock MCP tool test.
 *
 * Backend tool: GetAssetAssignedStockCommand + Handler — returns the parts /
 * tools / chemicals assigned to an asset plus the stock locations each item
 * sits in. Generic-proxy pattern (nock-mocked backend; no real network).
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

describe('UteamupAssetGetAssignedStock MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_asset_assigned_stock';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, 'UteamupAssetGetAssignedStock', toolArgs, mockReply);

  const sampleResponse = {
    parts: [
      {
        guid: 'p1111111-1111-1111-1111-111111111111',
        name: 'Bearing 6204',
        stockLocations: [
          {
            stockGuid: 's1111111-1111-1111-1111-111111111111',
            stockName: 'Main Warehouse',
            locationName: 'Building A',
            currentStock: 8,
            minimumAmount: 2,
            isAvailable: true,
            isDamaged: false,
            isLost: false,
          },
          {
            stockGuid: 's2222222-2222-2222-2222-222222222222',
            stockName: 'Site B Stockroom',
            locationName: 'Building B',
            currentStock: 1,
            minimumAmount: 3,
            isAvailable: true,
            isDamaged: false,
            isLost: false,
          },
        ],
      },
    ],
    tools: [
      {
        guid: 't1111111-1111-1111-1111-111111111111',
        name: 'Torque Wrench 40-200Nm',
        stockLocations: [],
      },
    ],
    chemicals: [],
  };

  it('returns parts/tools/chemicals with per-location stock rows for an asset GUID', async () => {
    const response = await call(
      { assetGuid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
      successReply(sampleResponse),
    );
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(Array.isArray(data.parts)).toBe(true);
    expect(Array.isArray(data.tools)).toBe(true);
    expect(Array.isArray(data.chemicals)).toBe(true);
    expect(data.parts).toHaveLength(1);
    expect(data.parts[0].stockLocations).toHaveLength(2);
    expect(data.parts[0].stockLocations[1].currentStock).toBe(1);
    expect(data.parts[0].stockLocations[1].minimumAmount).toBe(3);
    expect(data.tools[0].stockLocations).toEqual([]);
    expect(data.chemicals).toEqual([]);
  });

  it('returns empty arrays for an asset with no assignments', async () => {
    const response = await call(
      { assetGuid: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },
      successReply({ parts: [], tools: [], chemicals: [] }),
    );
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.parts).toEqual([]);
    expect(data.tools).toEqual([]);
    expect(data.chemicals).toEqual([]);
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
      name: 'UteamupAssetGetAssignedStock',
      args: { assetGuid: 'dddddddd-dddd-dddd-dddd-dddddddddddd' },
    },
  ];
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
