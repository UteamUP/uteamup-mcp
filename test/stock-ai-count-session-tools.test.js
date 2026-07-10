/**
 * Stock AI count session MCP tools test (stock-ai-seasonal-intelligence section 12).
 *
 * Three tools over the review side of the AI count flow:
 * UteamupStockGetAiCountSession, UteamupStockConfirmAiCountSession,
 * UteamupStockCancelAiCountSession.
 *
 * Session CREATE is intentionally absent from MCP/CLI (design Non-Goals): capture is
 * camera-bound (photo burst / video multipart upload) in the mobile/web app.
 * Generic-proxy pattern: nock-mocked backend /mcp POST, no real network.
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

describe('Stock AI count session MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_stock_ai_count';

  const SESSION_GUID = 'a1111111-1111-1111-1111-111111111111';
  const LINE_GUID = 'b2222222-2222-2222-2222-222222222222';
  const LINE_GUID_2 = 'c3333333-3333-3333-3333-333333333333';
  const STOCK_GUID = 'd4444444-4444-4444-4444-444444444444';
  const ITEM_GUID = 'e5555555-5555-5555-5555-555555555555';

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

  describe('UteamupStockGetAiCountSession', () => {
    it('returns the session with its suggested lines', async () => {
      const response = await call(
        'UteamupStockGetAiCountSession',
        { sessionGuid: SESSION_GUID },
        successReply({
          guid: SESSION_GUID,
          stockGuid: STOCK_GUID,
          sourceType: 'Photos',
          status: 'ReadyForReview',
          framesSampled: 3,
          framesAnalyzed: 3,
          creditsCharged: 3,
          lines: [
            {
              guid: LINE_GUID,
              stockItemGuid: ITEM_GUID,
              stockItemName: 'Bearing 6204',
              rawLabel: 'SKF 6204',
              suggestedCount: 12,
              confidence: 0.86,
              status: 'Suggested',
            },
          ],
        }),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.guid).toBe(SESSION_GUID);
      expect(data.status).toBe('ReadyForReview');
      expect(data.lines[0].guid).toBe(LINE_GUID);
      expect(data.lines[0].suggestedCount).toBe(12);
    });

    it('forwards the session GUID verbatim (GUIDs only, no int ids)', async () => {
      const captured = await captureCall('UteamupStockGetAiCountSession', { sessionGuid: SESSION_GUID });
      expect(captured.params.arguments).toEqual({ sessionGuid: SESSION_GUID });
    });
  });

  describe('UteamupStockConfirmAiCountSession', () => {
    it('forwards line decisions verbatim — the accept BOOLEAN keys rejection', async () => {
      const lines = [
        { lineGuid: LINE_GUID, accept: true, finalCount: 11 },
        { lineGuid: LINE_GUID_2, accept: false },
      ];
      const captured = await captureCall('UteamupStockConfirmAiCountSession', {
        sessionGuid: SESSION_GUID,
        lines,
        stockGuid: STOCK_GUID,
        takeName: 'Aisle 3 recount',
      });
      expect(captured.params.arguments).toEqual({
        sessionGuid: SESSION_GUID,
        lines,
        stockGuid: STOCK_GUID,
        takeName: 'Aisle 3 recount',
      });
      expect(captured.params.arguments.lines[1].accept).toBe(false);
    });

    it('supports manual item binding for unmatched lines', async () => {
      const captured = await captureCall('UteamupStockConfirmAiCountSession', {
        sessionGuid: SESSION_GUID,
        lines: [{ lineGuid: LINE_GUID, accept: true, stockItemGuid: ITEM_GUID }],
      });
      expect(captured.params.arguments.lines[0].stockItemGuid).toBe(ITEM_GUID);
    });

    it('returns the confirmed session with the draft take GUID', async () => {
      const takeGuid = 'f6666666-6666-6666-6666-666666666666';
      const response = await call(
        'UteamupStockConfirmAiCountSession',
        { sessionGuid: SESSION_GUID, lines: [{ lineGuid: LINE_GUID, accept: true }] },
        successReply({ guid: SESSION_GUID, status: 'Confirmed', stockTakeGuid: takeGuid }),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.status).toBe('Confirmed');
      expect(data.stockTakeGuid).toBe(takeGuid);
    });
  });

  describe('UteamupStockCancelAiCountSession', () => {
    it('returns the cancelled session', async () => {
      const response = await call(
        'UteamupStockCancelAiCountSession',
        { sessionGuid: SESSION_GUID },
        successReply({ guid: SESSION_GUID, status: 'Cancelled' }),
      );
      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.status).toBe('Cancelled');
    });

    it('surfaces a conflict error (confirmed sessions) without crashing the proxy', async () => {
      const response = await call(
        'UteamupStockCancelAiCountSession',
        { sessionGuid: SESSION_GUID },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Confirmed sessions cannot be cancelled' },
            id: 1,
          },
        },
      );
      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Confirmed');
    });
  });

  describe('identity comes from the Bearer token (spoofing guard)', () => {
    it.each([
      ['UteamupStockGetAiCountSession', { sessionGuid: SESSION_GUID }],
      ['UteamupStockConfirmAiCountSession', { sessionGuid: SESSION_GUID, lines: [{ lineGuid: LINE_GUID, accept: true }] }],
      ['UteamupStockCancelAiCountSession', { sessionGuid: SESSION_GUID }],
    ])('%s takes no userId / tenantId argument', async (name, args) => {
      const captured = await captureCall(name, args);
      expect(captured.params.arguments.userId).toBeUndefined();
      expect(captured.params.arguments.tenantId).toBeUndefined();
      expect(captured.params.arguments.tenantGuid).toBeUndefined();
    });
  });

  const allTools = [
    { name: 'UteamupStockGetAiCountSession', args: { sessionGuid: SESSION_GUID } },
    {
      name: 'UteamupStockConfirmAiCountSession',
      args: { sessionGuid: SESSION_GUID, lines: [{ lineGuid: LINE_GUID, accept: true }] },
    },
    { name: 'UteamupStockCancelAiCountSession', args: { sessionGuid: SESSION_GUID } },
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
