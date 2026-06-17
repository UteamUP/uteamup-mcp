/**
 * Stock AI count-from-photo MCP tool test.
 *
 * Backend tool (Command + Handler, generic-proxy pattern — nock-mocked backend,
 * no real network):
 *   UteamupStockCountFromPhoto — AI-counts the units of a stock item visible in a
 *                                base64-encoded shelf/bin photo (review-first suggestion,
 *                                nothing persisted; business outcomes ride the result body).
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  sendRawRequest,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Stock count-from-photo MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_stock_count_from_photo';

  const STOCK_ITEM_GUID = 'a1111111-1111-1111-1111-111111111111';
  // A tiny valid base64 string — the backend handler does the real magic-byte sniff.
  const PHOTO_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  /** Capture the forwarded JSON-RPC body for argument round-trip assertions. */
  const captureCall = async (toolName, toolArgs) => {
    let captured = null;
    nock(BASE_URL)
      .post('/mcp', body => {
        captured = body;
        return body.method === 'tools/call' && body.params?.name === toolName;
      })
      .reply(200, JSON.stringify(successReply({}).body), { 'Content-Type': 'application/json' });
    await sendRawRequest(BASE_URL, toolName, toolArgs);
    return captured;
  };

  it('returns a count suggestion for a photo of a known stock item', async () => {
    const response = await call(
      'UteamupStockCountFromPhoto',
      { photoBase64: PHOTO_BASE64, stockItemGuid: STOCK_ITEM_GUID },
      successReply({
        count: 12,
        confidence: 0.82,
        unit: 'pcs',
        notes: 'rear units may be hidden',
        stockItemGuid: STOCK_ITEM_GUID,
        stockItemName: 'Bearing 6204',
        provider: 'Gemini',
        modelName: 'gemini-2.0-flash',
        creditsCharged: 5,
        remaining: 95,
      }),
    );
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.count).toBe(12);
    expect(data.confidence).toBeCloseTo(0.82);
    expect(data.stockItemGuid).toBe(STOCK_ITEM_GUID);
    expect(data.creditsCharged).toBe(5);
  });

  it('surfaces an unreadable photo on the 200 body (null count, no error)', async () => {
    const response = await call(
      'UteamupStockCountFromPhoto',
      { photoBase64: PHOTO_BASE64 },
      successReply({ count: null, confidence: null, error: 'Could not read a count from the photo.', creditsCharged: 0, remaining: 100 }),
    );
    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.count).toBeNull();
    expect(data.error).toMatch(/could not read/i);
    expect(data.creditsCharged).toBe(0);
  });

  it('surfaces a quota-exhausted outcome on the 200 body', async () => {
    const response = await call(
      'UteamupStockCountFromPhoto',
      { photoBase64: PHOTO_BASE64 },
      successReply({ count: null, quotaBlockedReason: 'AI quota exhausted for this tenant.', creditsCharged: 0, remaining: 0 }),
    );
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.quotaBlockedReason).toMatch(/quota/i);
    expect(data.remaining).toBe(0);
  });

  it('surfaces a backend permission-denied as a JSON-RPC error', async () => {
    const response = await call(
      'UteamupStockCountFromPhoto',
      { photoBase64: PHOTO_BASE64 },
      errorReply(-32000, 'Permission denied: Stock.Update required'),
    );
    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/Permission denied/i);
  });

  it('forwards photoBase64 + stockItemGuid + context verbatim', async () => {
    const args = { photoBase64: PHOTO_BASE64, stockItemGuid: STOCK_ITEM_GUID, context: 'count only the blue boxes on the top shelf' };
    const captured = await captureCall('UteamupStockCountFromPhoto', args);
    expect(captured).not.toBeNull();
    expect(captured.params.arguments).toEqual(args);
  });

  it('takes NO userId / tenantId / tenantGuid args — identity comes from the Bearer token; stockItemGuid is a GUID', async () => {
    const captured = await captureCall('UteamupStockCountFromPhoto', { photoBase64: PHOTO_BASE64, stockItemGuid: STOCK_ITEM_GUID });
    expect(captured.params.arguments.userId).toBeUndefined();
    expect(captured.params.arguments.tenantId).toBeUndefined();
    expect(captured.params.arguments.tenantGuid).toBeUndefined();
    expect(captured.params.arguments.stockItemId).toBeUndefined();
    expect(captured.params.arguments.stockItemGuid).toBe(STOCK_ITEM_GUID);
  });

  // ---------------------------------------------------------------------------
  // Shared compliance / error handling
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupStockCountFromPhoto', args: { photoBase64: PHOTO_BASE64, stockItemGuid: STOCK_ITEM_GUID } },
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
