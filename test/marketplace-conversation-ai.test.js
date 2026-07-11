'use strict';

const nock = require('nock');
const { callMcpTool: proxyCall } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
} = require('./helpers/mcp-error-tests');

describe('Marketplace conversation AI tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_marketplace_conversation_ai';
  const conversationGuid = '11111111-1111-4111-8111-111111111111';
  const messageGuid = '22222222-2222-4222-8222-222222222222';
  const call = (name, args, reply) => proxyCall(BASE_URL, ACCESS_TOKEN, name, args, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('previews cost for the participant-scoped conversation', async () => {
    const response = await call('UteamupMarketplaceConversationAiSummaryCost', { conversationGuid }, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({
          operationKey: 'marketplace.conversation-summary',
          expectedCredits: 3,
          remaining: 10,
          canRun: true
        }) }] },
        id: 1
      }
    });

    expect(JSON.parse(response.body.result.content[0].text)).toMatchObject({
      operationKey: 'marketplace.conversation-summary',
      expectedCredits: 3
    });
  });

  test('returns an advisory summary with an explicit visible-message boundary', async () => {
    const response = await call('UteamupMarketplaceConversationAiSummary', {
      conversationGuid,
      language: 'English'
    }, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({
          conversationGuid,
          throughMessageGuid: messageGuid,
          messageCount: 4,
          summary: 'Confirm access before mobilization.',
          actionItems: ['Buyer confirms access.'],
          creditsCharged: 3,
          remaining: 7,
          disclaimer: 'Advisory summary of authorized messages only.'
        }) }] },
        id: 2
      }
    });

    const body = JSON.parse(response.body.result.content[0].text);
    expect(body).toMatchObject({ conversationGuid, throughMessageGuid: messageGuid, messageCount: 4 });
    expect(body).not.toHaveProperty('acceptedOfferRevisionGuid');
  });

  test('does not leak a conversation when participant authorization fails', async () => {
    const response = await call('UteamupMarketplaceConversationAiSummaryCost', { conversationGuid }, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Conversation not found.' },
        id: 3
      }
    });

    expect(response.body.error.message).toBe('Conversation not found.');
  });

  const tools = [
    { name: 'UteamupMarketplaceConversationAiSummaryCost', args: { conversationGuid } },
    { name: 'UteamupMarketplaceConversationAiSummary', args: { conversationGuid, language: 'English' } }
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
