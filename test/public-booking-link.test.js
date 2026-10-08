/**
 * Public Booking Link MCP tool tests
 *
 * Tools under test:
 *   UteamupPublicBookingLinkList()
 *   UteamupPublicBookingLinkCreate(model)
 *   UteamupPublicBookingLinkUpdate(linkGuid, model)
 *
 * Pattern mirrors bookable-resource.test.js: nock-mocked backend /mcp POST,
 * matched only when the forwarded arguments deep-equal the arguments sent.
 */

'use strict';

const nock = require('nock');
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

describe('Public Booking Link MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_public_booking_links';
  const linkGuid = 'b1111111-1111-4111-8111-111111111111';

  const linkModel = {
    name: 'Tool library',
    description: 'Borrow workshop tools',
    isActive: true,
    allowedResourceTypes: ['tool', 'equipment'],
    requiresApproval: true,
    minimumLeadTimeHours: 24,
    bookingHorizonDays: 30,
    maxDurationMinutes: 480,
    slotMinutes: 30,
    approvalDeadlineHours: 48,
    maxSubmissionsPerHour: 20,
  };
  const link = {
    guid: linkGuid,
    ...linkModel,
    createdAt: '2026-10-08T10:00:00Z',
    updatedAt: '2026-10-08T10:00:00Z',
  };

  const tools = [
    { name: 'UteamupPublicBookingLinkList', args: {}, response: [link] },
    { name: 'UteamupPublicBookingLinkCreate', args: { model: linkModel }, response: link },
    { name: 'UteamupPublicBookingLinkUpdate', args: { linkGuid, model: linkModel }, response: link },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, args, reply) => callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, args, reply, args);

  it.each(tools)(
    '$name returns the backend result and uses GUID-only identifiers',
    async ({ name, args, response: expected }) => {
      const response = await call(name, args, successReply(expected));
      const result = JSON.parse(response.body.result.content[0].text);

      expect(response.status).toBe(200);
      expect(response.body.error).toBeUndefined();
      expect(result).toEqual(expected);
      expect(JSON.stringify(args)).not.toMatch(/"(?:linkId|tenantId)"/);
    },
  );

  it('UteamupPublicBookingLinkList preserves an empty list', async () => {
    const response = await call('UteamupPublicBookingLinkList', {}, successReply([]));

    expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
  });

  it('UteamupPublicBookingLinkUpdate forwards a deactivated, auto-approving model verbatim', async () => {
    const model = {
      ...linkModel,
      description: null,
      isActive: false,
      allowedResourceTypes: ['facility'],
      requiresApproval: false,
      minimumLeadTimeHours: 0,
      bookingHorizonDays: 7,
      maxDurationMinutes: 60,
      slotMinutes: 15,
      approvalDeadlineHours: 1,
      maxSubmissionsPerHour: 1,
    };
    const args = { linkGuid, model };
    const expected = { ...link, ...model };

    const response = await call('UteamupPublicBookingLinkUpdate', args, successReply(expected));

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(expected);
  });

  it.each([
    ['UteamupPublicBookingLinkCreate', { model: { ...linkModel, allowedResourceTypes: [] } }, -32602,
      'At least one resource type is required'],
    ['UteamupPublicBookingLinkUpdate', { linkGuid, model: linkModel }, -32004, 'Booking link not found'],
  ])('%s round-trips a backend JSON-RPC error without inventing a result', async (name, args, code, message) => {
    const response = await call(name, args, errorReply(code, message));

    expect(response.body.error).toEqual({ code, message });
    expect(response.body.result).toBeUndefined();
  });

  const errorTools = tools.map(({ name, args }) => ({ name, args }));
  describeJsonRpcCompliance(call, errorTools);
  describe401Unauthorized(BASE_URL, errorTools);
  describe503ServiceUnavailable(BASE_URL, errorTools);
});
