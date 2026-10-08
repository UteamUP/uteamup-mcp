/**
 * Resource Reservation MCP tool tests
 *
 * Tools under test:
 *   UteamupResourceReservationList(statuses?, fromUtc?, toUtc?, resourceGuid?, mine?, page?, pageSize?)
 *   UteamupResourceReservationGet(reservationGuid)
 *   UteamupResourceReservationCreate(model, idempotencyKey)
 *   UteamupResourceReservationDecide(reservationGuid, decision, note?)
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

describe('Resource Reservation MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_resource_reservations';
  const reservationGuid = 'a1111111-1111-4111-8111-111111111111';
  const resourceGuid = 'a2222222-2222-4222-8222-222222222222';
  const sourceGuid = 'a3333333-3333-4333-8333-333333333333';
  const requesterUserGuid = 'a4444444-4444-4444-8444-444444444444';
  const idempotencyKey = 'a5555555-5555-4555-8555-555555555555';

  const reservation = {
    guid: reservationGuid,
    resourceGuid,
    resourceName: 'Hammer drill',
    resourceType: 'tool',
    startUtc: '2026-10-09T08:00:00Z',
    endUtc: '2026-10-09T12:00:00Z',
    capacityReserved: 1,
    status: 'requested',
    origin: 'internal',
    expiresAtUtc: null,
    purpose: 'Anchor bolts in pump room',
    notes: 'Bring spare bits',
    requesterUserGuid,
    requesterName: 'Anna Technician',
    bookerName: null,
    bookerEmail: null,
    bookerPhone: null,
    decidedAtUtc: null,
    decisionNote: null,
    checkedOutAtUtc: null,
    returnedAtUtc: null,
    createdAt: '2026-10-08T10:00:00Z',
    updatedAt: '2026-10-08T10:00:00Z',
  };
  const publicReservation = {
    ...reservation,
    guid: 'a6666666-6666-4666-8666-666666666666',
    status: 'pendingVerification',
    origin: 'public',
    expiresAtUtc: '2026-10-08T10:30:00Z',
    requesterUserGuid: null,
    requesterName: null,
    bookerName: 'External Booker',
    bookerEmail: 'booker@example.com',
    bookerPhone: '+3545551234',
  };
  const createModel = {
    resourceType: 'tool',
    sourceGuid,
    startUtc: reservation.startUtc,
    endUtc: reservation.endUtc,
    capacityRequested: 1,
    purpose: reservation.purpose,
    notes: reservation.notes,
  };

  const tools = [
    {
      name: 'UteamupResourceReservationList',
      args: {
        statuses: ['requested', 'confirmed'],
        fromUtc: '2026-10-01T00:00:00Z',
        toUtc: '2026-10-31T00:00:00Z',
        resourceGuid,
        mine: true,
        page: 2,
        pageSize: 25,
      },
      response: { items: [reservation, publicReservation], page: 2, pageSize: 25, totalCount: 27 },
    },
    {
      name: 'UteamupResourceReservationGet',
      args: { reservationGuid },
      response: reservation,
    },
    {
      name: 'UteamupResourceReservationCreate',
      args: { model: createModel, idempotencyKey },
      response: reservation,
    },
    {
      name: 'UteamupResourceReservationDecide',
      args: { reservationGuid, decision: 'approve', note: 'Approved for Friday' },
      response: { ...reservation, status: 'confirmed', decidedAtUtc: '2026-10-08T11:00:00Z',
        decisionNote: 'Approved for Friday' },
    },
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
      expect(JSON.stringify(args)).not.toMatch(
        /"(?:reservationId|resourceId|sourceId|userId|tenantId)"/,
      );
    },
  );

  it('UteamupResourceReservationList preserves an empty page', async () => {
    const expected = { items: [], page: 1, pageSize: 25, totalCount: 0 };

    const response = await call('UteamupResourceReservationList', {}, successReply(expected));

    expect(JSON.parse(response.body.result.content[0].text)).toEqual(expected);
  });

  it('UteamupResourceReservationList surfaces public-origin booker details', async () => {
    const args = { statuses: ['pendingVerification'], page: 1, pageSize: 10 };
    const expected = { items: [publicReservation], page: 1, pageSize: 10, totalCount: 1 };

    const response = await call('UteamupResourceReservationList', args, successReply(expected));
    const [item] = JSON.parse(response.body.result.content[0].text).items;

    expect(item.origin).toBe('public');
    expect(item.requesterUserGuid).toBeNull();
    expect(item.bookerEmail).toBe('booker@example.com');
  });

  it('UteamupResourceReservationCreate forwards the idempotency key verbatim', async () => {
    const model = { resourceType: 'facility', resourceGuid, startUtc: reservation.startUtc,
      endUtc: reservation.endUtc };
    const args = { model, idempotencyKey: 'ABCDEF01-2345-4678-9ABC-DEF012345678' };

    const response = await call('UteamupResourceReservationCreate', args, successReply(reservation));

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(reservation);
  });

  it.each(['approve', 'reject', 'cancel', 'checkOut', 'return'])(
    'UteamupResourceReservationDecide forwards decision "%s" verbatim',
    async (decision) => {
      const args = { reservationGuid, decision };
      const expected = { ...reservation, status: 'confirmed' };

      const response = await call('UteamupResourceReservationDecide', args, successReply(expected));

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body.result.content[0].text)).toEqual(expected);
    },
  );

  it.each([
    ['UteamupResourceReservationGet', { reservationGuid }, -32004, 'Reservation not found'],
    ['UteamupResourceReservationCreate', { model: createModel, idempotencyKey }, -32009,
      'The resource is not available for the requested window'],
    ['UteamupResourceReservationDecide', { reservationGuid, decision: 'return' }, -32602,
      'Cannot return a reservation that is not checked out'],
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
