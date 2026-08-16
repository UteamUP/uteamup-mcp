/**
 * Public reporting-link MCP proxy contracts.
 *
 * The proxy is generic, so these tests prove the reporting-link tools pass through
 * unchanged with GUID-only identifiers, and that the unauthenticated submit endpoint
 * is NOT reachable as a tool — it is captcha-gated and rate-limited by design, and a
 * scripted authenticated path around that would be an abuse vector.
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

describe('Public reporting-link MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_public_report_links';
  const LINK_GUID = '44444444-4444-4444-8444-444444444444';
  const LOCATION_GUID = '55555555-5555-4555-8555-555555555555';

  const createArgs = {
    name: 'Warehouse B - loading dock',
    requireContactDetails: false,
    allowPhotoUpload: true,
    defaultLocationGuid: LOCATION_GUID,
    maxSubmissionsPerHour: 20,
  };

  const tools = [
    { name: 'UteamupReportLinkList', args: {} },
    { name: 'UteamupReportLinkGet', args: { guid: LINK_GUID } },
    { name: 'UteamupReportLinkCreate', args: createArgs },
    { name: 'UteamupReportLinkUpdate', args: { guid: LINK_GUID, name: 'Renamed', isActive: false } },
    { name: 'UteamupReportLinkRegenerateToken', args: { guid: LINK_GUID } },
    { name: 'UteamupReportLinkDelete', args: { guid: LINK_GUID } },
  ];

  // An integer id leaking here would contradict the GUIDs-in / integer-ids-out rule
  // and hand callers an enumerable identifier for a public-facing resource.
  const forbiddenIntegerIdentityKeys = new Set([
    'id',
    'linkId',
    'tenantId',
    'defaultLocationId',
    'defaultCategoryId',
    'defaultAssetId',
    'notifyTeamId',
  ]);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const captureCall = async (toolName, toolArgs) => {
    let captured = null;
    nock(BASE_URL)
      .post('/mcp', body => {
        captured = body;
        return body.method === 'tools/call' && body.params?.name === toolName;
      })
      .reply(200, JSON.stringify(successReply({}).body), {
        'Content-Type': 'application/json',
      });

    await sendRawRequest(BASE_URL, toolName, toolArgs);
    return captured;
  };

  it.each(tools)('forwards $name arguments unchanged', async ({ name, args }) => {
    const captured = await captureCall(name, args);

    expect(captured.method).toBe('tools/call');
    expect(captured.params).toEqual({ name, arguments: args });
  });

  it('keeps identifiers GUID-only on the wire', async () => {
    for (const { name, args } of tools) {
      const captured = await captureCall(name, args);
      for (const key of Object.keys(captured.params.arguments)) {
        expect(forbiddenIntegerIdentityKeys).not.toContain(key);
      }
      nock.cleanAll();
    }
  });

  it('returns the token on create so a poster can be printed', async () => {
    const response = await call('UteamupReportLinkCreate', createArgs, successReply({
      guid: LINK_GUID,
      token: 'K7f2QhabcdEFghij012345',
      name: 'Warehouse B - loading dock',
      isActive: true,
      requireContactDetails: false,
      submissionCount: 0,
    }));

    const link = JSON.parse(response.result.content[0].text);
    expect(link.token).toBe('K7f2QhabcdEFghij012345');
    expect(link.requireContactDetails).toBe(false);
    expect(link.id).toBeUndefined();
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
