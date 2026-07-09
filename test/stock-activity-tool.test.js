/**
 * Stock activity feed MCP tool test (stock-ux-refactor group 22, Phase L).
 *
 * UteamupStockGetActivity — tenant-wide, newest-first union feed over stock
 * movements, workorder stock transactions, stock take lifecycle events, alerts
 * and lifecycle-rule execution logs. Generic-proxy pattern: nock-mocked backend
 * /mcp POST, no real network.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  sendRawRequest,
  successReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Stock activity feed MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_stock_activity';

  const STOCK_GUID = 'a1111111-1111-1111-1111-111111111111';
  const ITEM_GUID = 'b2222222-2222-2222-2222-222222222222';

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

  describe('UteamupStockGetActivity', () => {
    it('returns the paged activity feed', async () => {
      const response = await call(
        'UteamupStockGetActivity',
        { page: 1, pageSize: 50 },
        successReply({
          items: [
            {
              occurredAtUtc: '2026-06-10T08:00:00Z',
              eventType: 'movement',
              itemGuid: ITEM_GUID,
              itemName: 'Bearing 6204',
              stockGuid: STOCK_GUID,
              stockName: 'Main Store',
              actorUserId: 'user-1',
              actorName: 'demo@iteggs.com',
              quantityDelta: 5,
              summaryCode: 'movement_add',
              summaryArgsJson: '{"itemName":"Bearing 6204","quantity":5}',
            },
          ],
          totalItems: 1,
          page: 1,
          pageSize: 50,
        }),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.totalItems).toBe(1);
      expect(data.items[0].eventType).toBe('movement');
      expect(data.items[0].summaryCode).toBe('movement_add');
      expect(data.items[0].itemGuid).toBe(ITEM_GUID);
    });

    it('forwards every filter argument unchanged (GUIDs only, no int ids)', async () => {
      const captured = await captureCall('UteamupStockGetActivity', {
        eventTypes: ['movement', 'alert'],
        stockGuid: STOCK_GUID,
        itemGuid: ITEM_GUID,
        from: '2026-06-01T00:00:00Z',
        to: '2026-06-30T23:59:59Z',
        search: 'bearing',
        page: 2,
        pageSize: 25,
      });
      expect(captured.params.arguments).toEqual({
        eventTypes: ['movement', 'alert'],
        stockGuid: STOCK_GUID,
        itemGuid: ITEM_GUID,
        from: '2026-06-01T00:00:00Z',
        to: '2026-06-30T23:59:59Z',
        search: 'bearing',
        page: 2,
        pageSize: 25,
      });
    });
  });

  const allTools = [
    { name: 'UteamupStockGetActivity', args: { page: 1, pageSize: 50 } },
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
