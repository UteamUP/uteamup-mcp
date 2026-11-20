/**
 * Journal link suggestion MCP tool tests.
 *
 * The backend registers UteamupJournalLinkSuggestions (exact + fuzzy only, no AI credits);
 * this proxy test verifies JSON-RPC forwarding and the GUID-only suggestion shape.
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

describe('Journal link suggestions MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_journal_link_suggestions';
  const ASSET_GUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const TEXT = 'Skipti um þéttingu á Dælu 3 og pressunni';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  it('returns GUID-only suggestions with offsets and method, and no AI charge', async () => {
    const response = await call(
      'UteamupJournalLinkSuggestions',
      { text: TEXT },
      successReply({
        suggestions: [{
          type: 'asset', guid: ASSET_GUID, displayName: 'Dæla 3', secondary: 'P-3',
          matchedText: 'Dælu 3', start: 21, length: 6, confidence: 0.85, method: 'fuzzy',
        }],
        searchedTypes: ['asset', 'part'],
        aiUsed: false,
        creditsCharged: 0,
        warnings: [],
      }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.suggestions[0].guid).toBe(ASSET_GUID);
    expect(data.suggestions[0].id).toBeUndefined();
    expect(data.suggestions[0].method).toBe('fuzzy');
    expect(data.aiUsed).toBe(false);
    expect(data.creditsCharged).toBe(0);
  });

  it('forwards only the text argument', async () => {
    let captured = null;
    nock(BASE_URL)
      .post('/mcp', (body) => {
        captured = body;
        return body.method === 'tools/call' && body.params?.name === 'UteamupJournalLinkSuggestions';
      })
      .reply(200, JSON.stringify(successReply({ suggestions: [] }).body), { 'Content-Type': 'application/json' });
    await sendRawRequest(BASE_URL, 'UteamupJournalLinkSuggestions', { text: TEXT });
    expect(captured.params.arguments).toEqual({ text: TEXT });
    expect(captured.params.arguments.aiAssist).toBeUndefined();
  });

  it('surfaces permission denied as a JSON-RPC error', async () => {
    const response = await call(
      'UteamupJournalLinkSuggestions',
      { text: TEXT },
      errorReply(-32000, 'Permission denied: Journal.View required'),
    );
    expect(response.body.error.message).toMatch(/Permission denied/i);
  });

  it('surfaces over-long text as a validation error', async () => {
    const response = await call(
      'UteamupJournalLinkSuggestions',
      { text: 'x'.repeat(8001) },
      errorReply(-32602, 'Text must be at most 8000 characters.'),
    );
    expect(response.body.error.message).toMatch(/8000/);
  });

  const allTools = [{ name: 'UteamupJournalLinkSuggestions', args: { text: TEXT } }];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
