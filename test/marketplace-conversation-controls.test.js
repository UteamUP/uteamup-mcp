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

  test('round-trips a server-owned meeting proposal', async () => {
    const response = await call('UteamupMarketplaceConversationMeetingCreate', {
      conversationGuid,
      subject: 'Scope review',
      scheduledStartUtc: '2026-08-01T10:00:00Z',
      scheduledEndUtc: '2026-08-01T11:00:00Z',
      timeZone: 'Atlantic/Reykjavik',
      location: 'Turbine hall',
      notes: 'Bring PPE'
    }, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({
          guid: messageGuid,
          type: 'meetingProposal',
          meetingProposal: { status: 'proposed', subject: 'Scope review' }
        }) }] },
        id: 5
      }
    });

    expect(JSON.parse(response.body.result.content[0].text)).toMatchObject({
      guid: messageGuid,
      meetingProposal: { status: 'proposed' }
    });
  });

  test('round-trips a typed meeting response', async () => {
    const response = await call('UteamupMarketplaceConversationMeetingRespond', {
      conversationGuid,
      messageGuid,
      status: 'Accepted'
    }, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({
          guid: messageGuid,
          meetingProposal: { status: 'accepted' }
        }) }] },
        id: 6
      }
    });

    expect(JSON.parse(response.body.result.content[0].text).meetingProposal.status).toBe('accepted');
  });

  test('round-trips an entitled base64 iCalendar download', async () => {
    const response = await call('UteamupMarketplaceConversationMeetingCalendarDownload', {
      conversationGuid,
      messageGuid
    }, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({
          fileName: 'meeting.ics',
          contentType: 'text/calendar; charset=utf-8',
          base64Data: 'QkVHSU46VkNBTEVOREFS',
          fileSizeBytes: 15
        }) }] },
        id: 7
      }
    });

    expect(JSON.parse(response.body.result.content[0].text)).toMatchObject({
      fileName: 'meeting.ics',
      contentType: 'text/calendar; charset=utf-8'
    });
  });

  test('round-trips an authoritative offer card snapshot', async () => {
    const offerRevisionGuid = '33333333-3333-4333-8333-333333333333';
    const response = await call('UteamupMarketplaceConversationOfferCardCreate', {
      conversationGuid,
      offerRevisionGuid
    }, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({
          guid: messageGuid,
          type: 'offerCard',
          offerCard: { offerRevisionGuid, labourSubtotal: 1000, providerFeeAmount: 100 }
        }) }] },
        id: 8
      }
    });

    expect(JSON.parse(response.body.result.content[0].text)).toMatchObject({
      type: 'offerCard',
      offerCard: { offerRevisionGuid, providerFeeAmount: 100 }
    });
  });

  test('round-trips a server-owned consent-stage contact card', async () => {
    const response = await call('UteamupMarketplaceConversationContactCardCreate', {
      conversationGuid,
      includeEmail: true,
      includePhone: false,
      includeWebsite: true
    }, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({
          guid: messageGuid,
          type: 'contactCard',
          contactCard: {
            displayName: 'Provider Owner',
            email: 'provider@example.com',
            phone: null,
            website: 'https://provider.example.com'
          }
        }) }] },
        id: 9
      }
    });

    expect(JSON.parse(response.body.result.content[0].text)).toMatchObject({
      type: 'contactCard',
      contactCard: {
        email: 'provider@example.com',
        phone: null
      }
    });
  });

  test('round-trips an entitled base64 vCard download', async () => {
    const response = await call('UteamupMarketplaceConversationContactCardDownload', {
      conversationGuid,
      messageGuid
    }, {
      status: 200,
      body: {
        jsonrpc: '2.0',
        result: { content: [{ type: 'text', text: JSON.stringify({
          fileName: 'contact.vcf',
          contentType: 'text/vcard; charset=utf-8',
          base64Data: 'QkVHSU46VkNBUkQ=',
          fileSizeBytes: 11
        }) }] },
        id: 10
      }
    });

    expect(JSON.parse(response.body.result.content[0].text)).toMatchObject({
      fileName: 'contact.vcf',
      contentType: 'text/vcard; charset=utf-8'
    });
  });

  const tools = [
    { name: 'UteamupMarketplaceConversationMessagesSearch', args: { conversationGuid, query: 'permit' } },
    { name: 'UteamupMarketplaceConversationPreferencesUpdate', args: { conversationGuid, isMuted: true } },
    { name: 'UteamupMarketplaceConversationMessagePinUpdate', args: { conversationGuid, messageGuid, isPinned: true } },
    { name: 'UteamupMarketplaceConversationMeetingCreate', args: {
      conversationGuid,
      subject: 'Scope review',
      scheduledStartUtc: '2026-08-01T10:00:00Z',
      scheduledEndUtc: '2026-08-01T11:00:00Z',
      timeZone: 'UTC'
    } },
    { name: 'UteamupMarketplaceConversationMeetingRespond', args: { conversationGuid, messageGuid, status: 'Accepted' } },
    { name: 'UteamupMarketplaceConversationMeetingCalendarDownload', args: { conversationGuid, messageGuid } },
    { name: 'UteamupMarketplaceConversationOfferCardCreate', args: {
      conversationGuid,
      offerRevisionGuid: '33333333-3333-4333-8333-333333333333'
    } },
    { name: 'UteamupMarketplaceConversationContactCardCreate', args: {
      conversationGuid,
      includeEmail: true,
      includePhone: false,
      includeWebsite: true
    } },
    { name: 'UteamupMarketplaceConversationContactCardDownload', args: { conversationGuid, messageGuid } }
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
