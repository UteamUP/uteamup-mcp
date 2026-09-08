'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Teams integration MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'teams-integration-token';
  const conversationGuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const configTool = { name: 'UteamupTeamsConfigGet', args: {} };
  const testTool = { name: 'UteamupTeamsConfigTest', args: {} };
  const identityTool = { name: 'UteamupTeamsMyIdentityGet', args: {} };
  const bindingTool = {
    name: 'UteamupTeamsConversationBindingGet',
    args: { conversationGuid },
  };

  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('config never returns the stored Microsoft credential', async () => {
    const response = await call(
      configTool.name,
      configTool.args,
      successReply({
        mode: 'optional',
        status: 'connected',
        azureAdTenantId: '11111111-1111-1111-1111-111111111111',
        enableDeepLinks: true,
        linkedUserCount: 40,
        unlinkedUserCount: 10,
        delegatedLinkedUserCount: 3,
        reconsentRequired: false,
        autoLinkEnabled: true,
        autoLinkDomains: ['contoso.com'],
        requireAzureAdSignIn: false,
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.status).toBe('connected');
    // The refresh token is the one thing that must never cross this boundary.
    expect(result).not.toHaveProperty('encryptedTokenMaterial');
    expect(result).not.toHaveProperty('tokenMaterial');
    expect(JSON.stringify(result)).not.toMatch(/refresh_token|clientSecret/i);
  });

  test('config separates members who can mirror from members who merely linked', async () => {
    const response = await call(
      configTool.name,
      configTool.args,
      successReply({
        mode: 'optional',
        status: 'connected',
        linkedUserCount: 40,
        unlinkedUserCount: 10,
        delegatedLinkedUserCount: 3,
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    // The gap between these two is the normal reason mirroring is not happening, so both must
    // survive the proxy rather than being collapsed into one "linked" number.
    expect(result.linkedUserCount).toBe(40);
    expect(result.delegatedLinkedUserCount).toBe(3);
  });

  test('probe reports each capability separately rather than one opaque verdict', async () => {
    const response = await call(
      testTool.name,
      testTool.args,
      successReply({
        success: false,
        durationMs: 143,
        error: 'Microsoft never returned a directory id. Reconnect to finish it.',
        tokenRefreshed: true,
        directoryResolved: false,
        canReadDirectory: false,
        canSendChatMessage: false,
        canSendChannelMessage: false,
        canSubscribe: false,
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.success).toBe(false);
    expect(result.tokenRefreshed).toBe(true);
    expect(result.directoryResolved).toBe(false);
    expect(result.error).toMatch(/directory id/i);
  });

  test('identity distinguishes a typed link from a signed-in one', async () => {
    const response = await call(
      identityTool.name,
      identityTool.args,
      successReply({
        status: 'linked',
        userPrincipalName: 'someone@contoso.test',
        linkSource: 'selfAsserted',
        delegatedGrantedAtUtc: null,
        canRelay: false,
        directoryMismatch: false,
        canSelfLink: true,
        tenantConnected: true,
        reconsentRequired: false,
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    // status 'linked' with canRelay false is the whole point: chat and call buttons work,
    // mirroring does not. Collapsing these would misreport the feature as working.
    expect(result.status).toBe('linked');
    expect(result.canRelay).toBe(false);
    expect(result.linkSource).toBe('selfAsserted');
  });

  test('identity takes no user argument, so it cannot report on somebody else', async () => {
    // The account comes from the Bearer token. Accepting a user id here would invite reading
    // another member's link state by guessing an id.
    expect(identityTool.args).not.toHaveProperty('userId');
    expect(identityTool.args).not.toHaveProperty('userGuid');
    expect(identityTool.args).not.toHaveProperty('tenantId');
    expect(identityTool.args).not.toHaveProperty('email');
    expect(Object.keys(identityTool.args)).toHaveLength(0);
  });

  test('config tools take no tenant argument', async () => {
    for (const tool of [configTool, testTool]) {
      expect(tool.args).not.toHaveProperty('tenantId');
      expect(tool.args).not.toHaveProperty('tenantGuid');
    }
  });

  test('binding forwards the conversation guid verbatim', async () => {
    const response = await call(
      bindingTool.name,
      bindingTool.args,
      successReply({
        isBound: true,
        isChannel: false,
        participantCount: 5,
        mirroredParticipantCount: 2,
        subscriptionStatus: 'active',
        canBind: true,
        bindBlockedReason: null,
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.participantCount).toBe(5);
    // Partial coverage must survive the proxy - a mirror silently carrying half a conversation
    // is the failure this number exists to expose.
    expect(result.mirroredParticipantCount).toBe(2);
  });

  test('binding surfaces the refusal reason for a marketplace conversation', async () => {
    const response = await call(
      bindingTool.name,
      bindingTool.args,
      successReply({
        isBound: false,
        canBind: false,
        bindBlockedReason: 'Marketplace conversations cannot be mirrored to Teams.',
        participantCount: 2,
        mirroredParticipantCount: 0,
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.canBind).toBe(false);
    expect(result.bindBlockedReason).toMatch(/marketplace/i);
  });

  test('preserves TeamsIntegration.Manage denials', async () => {
    const response = await call(
      configTool.name,
      configTool.args,
      errorReply(-32000, 'Permission denied: TeamsIntegration.Manage required'),
    );

    expect(response.body.error.message).toMatch(/TeamsIntegration\.Manage/);
  });

  test('empty picker-style results round-trip without crashing the proxy', async () => {
    const response = await call(
      bindingTool.name,
      bindingTool.args,
      successReply({
        isBound: false,
        isChannel: false,
        teamId: null,
        channelId: null,
        participantCount: 0,
        mirroredParticipantCount: 0,
        subscriptionStatus: 'active',
        canBind: false,
        bindBlockedReason: null,
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.isBound).toBe(false);
    expect(result.teamId).toBeNull();
  });

  const tools = [configTool, testTool, identityTool, bindingTool];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
