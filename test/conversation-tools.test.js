'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Conversation MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'conversation-tools-token';
  const CONVERSATION_GUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

  const call = (toolName, toolArgs, reply, expectedArgs) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply, expectedArgs);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('lists the caller conversations', async () => {
    const response = await call(
      'UteamupConversationList',
      {},
      successReply([
        {
          guid: CONVERSATION_GUID,
          contextType: 'directMessage',
          name: 'Ana Jonsdottir',
          unreadCount: 3,
          isMuted: false,
          isArchived: false,
        },
      ]),
    );

    const [item] = JSON.parse(response.body.result.content[0].text);
    expect(item.guid).toBe(CONVERSATION_GUID);
    expect(item.unreadCount).toBe(3);
  });

  test('returns an empty list rather than null when there are no conversations', async () => {
    const response = await call('UteamupConversationList', {}, successReply([]));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });

  test('reads one conversation with its messages in sequence order', async () => {
    const response = await call(
      'UteamupConversationGet',
      { conversationGuid: CONVERSATION_GUID },
      successReply({
        guid: CONVERSATION_GUID,
        contextType: 'directMessage',
        canSendMessages: true,
        participants: [{ guid: 'p1', displayName: 'Ana Jonsdottir' }],
        messages: [
          { guid: 'm1', sequenceNumber: 1, body: 'First' },
          { guid: 'm2', sequenceNumber: 2, body: 'Second' },
        ],
      }),
    );

    const conversation = JSON.parse(response.body.result.content[0].text);
    expect(conversation.messages.map((m) => m.sequenceNumber)).toEqual([1, 2]);
  });

  test('forwards send arguments verbatim, including the idempotency key', async () => {
    const args = {
      conversationGuid: CONVERSATION_GUID,
      model: {
        body: 'Filter replaced, unit back online.',
        clientMessageId: 'a1b2c3d4-0000-4000-8000-000000000001',
      },
    };

    const response = await call(
      'UteamupConversationMessageSend',
      args,
      successReply({ guid: 'm3', sequenceNumber: 3, body: args.model.body }),
      args,
    );

    const message = JSON.parse(response.body.result.content[0].text);
    expect(message.sequenceNumber).toBe(3);
  });

  test('surfaces a permission error without crashing the proxy', async () => {
    const response = await call(
      'UteamupConversationMessageSend',
      { conversationGuid: CONVERSATION_GUID, model: { body: 'nope' } },
      errorReply(-32603, 'Permission denied: Conversation.Send required'),
    );

    expect(response.body.error.message).toMatch(/Conversation\.Send/);
  });

  test('searches within one conversation', async () => {
    const response = await call(
      'UteamupConversationMessagesSearch',
      { conversationGuid: CONVERSATION_GUID, query: 'filter' },
      successReply([{ guid: 'm3', sequenceNumber: 3, body: 'Filter replaced.' }]),
    );

    expect(JSON.parse(response.body.result.content[0].text)).toHaveLength(1);
  });

  // Regression guard. The acting user comes from the bearer token, so exposing an identity
  // argument would let a caller read someone else's inbox or post as them. Asserting the
  // absence here means a future contributor adding one has to delete a test to do it.
  describe('never accepts a caller identity as an argument', () => {
    const identityKeys = [
      'userId',
      'userGuid',
      'senderId',
      'senderGuid',
      'onBehalfOf',
      'tenantId',
    ];

    test.each([
      ['UteamupConversationList', {}],
      ['UteamupConversationGet', { conversationGuid: CONVERSATION_GUID }],
      ['UteamupConversationMessagesSearch', { conversationGuid: CONVERSATION_GUID, query: 'x' }],
    ])('%s forwards no identity argument', async (toolName, args) => {
      await call(toolName, args, successReply([]), args);
      for (const key of identityKeys) {
        expect(Object.keys(args)).not.toContain(key);
      }
    });
  });

  const tools = [
    { name: 'UteamupConversationList', args: {} },
    { name: 'UteamupConversationGet', args: { conversationGuid: CONVERSATION_GUID } },
    {
      name: 'UteamupConversationMessageSend',
      args: { conversationGuid: CONVERSATION_GUID, model: { body: 'hello' } },
    },
    {
      name: 'UteamupConversationMessagesSearch',
      args: { conversationGuid: CONVERSATION_GUID, query: 'filter' },
    },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
