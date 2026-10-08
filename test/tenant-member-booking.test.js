/**
 * Tenant member booking settings + my booking preferences MCP tool tests
 *
 * Tools under test:
 *   UteamupTenantMemberBookingSettingsUpdate(userGuid, isBookableResource?, allowPublicBooking?)
 *   UteamupMyBookingPreferencesGet()
 *   UteamupMyBookingPreferencesUpdate(publicBookingOptOut)
 *
 * Pattern mirrors bookable-resource.test.js: nock-mocked backend /mcp POST,
 * matched only when the forwarded arguments deep-equal the arguments sent.
 */

'use strict';

const nock = require('nock');
const https = require('https');
const {
  callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Tenant member booking MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_member_booking';
  const userGuid = 'c1111111-1111-4111-8111-111111111111';

  const settings = {
    userGuid,
    isBookableResource: true,
    allowPublicBooking: true,
    publicBookingOptOut: false,
  };

  const tools = [
    {
      name: 'UteamupTenantMemberBookingSettingsUpdate',
      args: { userGuid, isBookableResource: true, allowPublicBooking: true },
      response: settings,
    },
    { name: 'UteamupMyBookingPreferencesGet', args: {}, response: settings },
    {
      name: 'UteamupMyBookingPreferencesUpdate',
      args: { publicBookingOptOut: true },
      response: { ...settings, publicBookingOptOut: true },
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, args, reply) => callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, args, reply, args);

  it.each(tools)(
    '$name returns the settings shape and uses GUID-only identifiers',
    async ({ name, args, response: expected }) => {
      const response = await call(name, args, successReply(expected));
      const result = JSON.parse(response.body.result.content[0].text);

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      expect(result).toEqual(expected);
      expect(JSON.stringify(args)).not.toMatch(/"(?:userId|memberId|tenantId)"/);
    },
  );

  it('UteamupTenantMemberBookingSettingsUpdate forwards a single optional flag verbatim', async () => {
    const args = { userGuid, allowPublicBooking: false };
    const expected = { ...settings, allowPublicBooking: false };

    const response = await call('UteamupTenantMemberBookingSettingsUpdate', args, successReply(expected));

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(expected);
  });

  it('UteamupMyBookingPreferencesGet returns defaults for a member who is not bookable', async () => {
    const expected = { userGuid, isBookableResource: false, allowPublicBooking: false, publicBookingOptOut: false };

    const response = await call('UteamupMyBookingPreferencesGet', {}, successReply(expected));

    expect(JSON.parse(response.body.result.content[0].text)).toEqual(expected);
  });

  it.each([
    ['UteamupTenantMemberBookingSettingsUpdate', { userGuid, isBookableResource: false }, -32004,
      'Tenant member not found'],
    ['UteamupMyBookingPreferencesUpdate', { publicBookingOptOut: false }, -32003,
      'Booking preferences require tenant membership'],
  ])('%s round-trips a backend JSON-RPC error without inventing a result', async (name, args, code, message) => {
    const response = await call(name, args, errorReply(code, message));

    expect(response.body.error).toEqual({ code, message });
    expect(response.body.result).toBeUndefined();
  });

  describe('user-scoped regression guards', () => {
    // The backend resolves the caller from the Bearer token. A userGuid or
    // tenantId argument on the "my" tools would invite a caller to change
    // another member's public-booking opt-out.
    function captureForwardedArguments(toolName, toolArgs) {
      let forwarded;
      nock(BASE_URL)
        .post('/mcp', (body) => {
          forwarded = body.params?.arguments;
          return body.method === 'tools/call' && body.params?.name === toolName;
        })
        .reply(200, JSON.stringify(successReply({ ...settings, publicBookingOptOut: true }).body), {
          'Content-Type': 'application/json',
        });

      const data = JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: toolName, arguments: toolArgs },
        id: 1,
      });

      return new Promise((resolve, reject) => {
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
          },
          rejectUnauthorized: false,
        }, (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve(forwarded));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });
    }

    it('UteamupMyBookingPreferencesUpdate sends ONLY publicBookingOptOut', async () => {
      const forwarded = await captureForwardedArguments(
        'UteamupMyBookingPreferencesUpdate',
        { publicBookingOptOut: true },
      );

      expect(Object.keys(forwarded)).toEqual(['publicBookingOptOut']);
      expect(forwarded).not.toHaveProperty('userGuid');
      expect(forwarded).not.toHaveProperty('userId');
      expect(forwarded).not.toHaveProperty('tenantId');
      expect(forwarded).not.toHaveProperty('tenantGuid');
    });

    it('UteamupMyBookingPreferencesGet takes NO arguments', async () => {
      const forwarded = await captureForwardedArguments('UteamupMyBookingPreferencesGet', {});

      expect(forwarded).toEqual({});
    });
  });

  const errorTools = tools.map(({ name, args }) => ({ name, args }));
  describeJsonRpcCompliance(call, errorTools);
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
