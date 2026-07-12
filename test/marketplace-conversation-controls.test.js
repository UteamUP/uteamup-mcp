'use strict';

const nock = require('nock');
const { callMcpTool: proxyCall } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
} = require('./helpers/mcp-error-tests');

describe('Marketplace conversation control tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_marketplace_conversation_controls';
  const conversationGuid = '11111111-1111-4111-8111-111111111111';
  const messageGuid = '22222222-2222-4222-8222-222222222222';
  const call = (name, args, reply) => proxyCall(BASE_URL, ACCESS_TOKEN, name, args, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('round-trips participant-scoped search results', async () => {
    const response = await call('UteamupMarketplaceConversationMessagesSearch', {
      conversationGuid,
      query: 'permit'
    }, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify([{ messageGuid, body: 'Permit' }]) }] },
        id: 1
      }
    });

    expect(JSON.parse(response.body.result.content[0].text)).toEqual([
      { messageGuid, body: 'Permit' }
    ]);
  });

  test('round-trips per-participant mute state', async () => {
    const response = await call('UteamupMarketplaceConversationPreferencesUpdate', {
      conversationGuid,
      isMuted: true
    }, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({ conversationGuid, isMuted: true }) }] },
        id: 2
      }
    });

    expect(JSON.parse(response.body.result.content[0].text)).toMatchObject({ isMuted: true });
  });

  test('round-trips owner-controlled shared pin state', async () => {
    const response = await call('UteamupMarketplaceConversationMessagePinUpdate', {
      conversationGuid,
      messageGuid,
      isPinned: true
    }, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({ messageGuid, isPinned: true }) }] },
        id: 3
      }
    });

    expect(JSON.parse(response.body.result.content[0].text)).toMatchObject({ isPinned: true });
  });

  test('does not expose unauthorized conversation history', async () => {
    const response = await call('UteamupMarketplaceConversationMessagesSearch', {
      conversationGuid,
      query: 'permit'
    }, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Conversation not found.' },
        id: 4
      }
    });

    expect(response.body.error.message).toBe('Conversation not found.');
  });

  const tools = [
    { name: 'UteamupMarketplaceConversationMessagesSearch', args: { conversationGuid, query: 'permit' } },
    { name: 'UteamupMarketplaceConversationPreferencesUpdate', args: { conversationGuid, isMuted: true } },
    { name: 'UteamupMarketplaceConversationMessagePinUpdate', args: { conversationGuid, messageGuid, isPinned: true } }
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
