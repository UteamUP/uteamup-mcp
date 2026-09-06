/**
 * Shift Handover Acceptance MCP tool tests
 *
 * Tests that shift handover acceptance MCP tool calls are correctly formed as
 * JSON-RPC 2.0 requests and that the MCP proxy properly handles both successful
 * and error responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   Lifecycle mutations also require concurrencyToken and idempotencyKey.
 *   UteamupShiftHandoverStartReview(handoverGuid, concurrencyToken, idempotencyKey)
 *   UteamupShiftHandoverAccept(handoverGuid, concurrencyToken, idempotencyKey, notes?)
 *   UteamupShiftHandoverComplete(handoverGuid, concurrencyToken, idempotencyKey)
 *   UteamupShiftHandoverDeclineAcceptance(handoverGuid, concurrencyToken, idempotencyKey, notes?)
 *   UteamupShiftHandoverGetPendingAcceptances()
 *   UteamupShiftHandoverCreate(shiftGuid, shiftDate, shiftInstanceGuid?, journalGuid?, journalGenerationType?, journalName?)
 *
 * Pattern mirrors schedule-assignment.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const https = require('https');
const { callMcpTool: _callMcpTool } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Shift Handover Acceptance MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_shift_handover_acceptance';
  const HANDOVER_GUID = '11111111-1111-4111-8111-111111111111';
  const TENANT_GUID = '88888888-8888-4888-8888-888888888888';
  const SHIFT_GUID = '33333333-3333-4333-8333-333333333333';
  const SHIFT_INSTANCE_GUID = '44444444-4444-4444-8444-444444444444';
  const JOURNAL_GUID = '55555555-5555-4555-8555-555555555555';
  const SECOND_HANDOVER_GUID = '22222222-2222-4222-8222-222222222222';
  const UNKNOWN_HANDOVER_GUID = '99999999-9999-4999-8999-999999999999';

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  const lifecycleMutationTools = new Set([
    'UteamupShiftHandoverStartReview',
    'UteamupShiftHandoverAccept',
    'UteamupShiftHandoverComplete',
    'UteamupShiftHandoverDeclineAcceptance',
  ]);
  const call = (toolName, toolArgs, mockReply) => _callMcpTool(
    BASE_URL,
    ACCESS_TOKEN,
    toolName,
    lifecycleMutationTools.has(toolName)
      ? {
          concurrencyToken: 'latest-concurrency-token',
          idempotencyKey: '77777777-7777-4777-8777-777777777777',
          ...toolArgs,
        }
      : toolArgs,
    mockReply,
  );

  // ---------------------------------------------------------------------------
  // Shared mock data
  // ---------------------------------------------------------------------------
  const handover = {
    guid: HANDOVER_GUID,
    tenantGuid: TENANT_GUID,
    shiftGuid: SHIFT_GUID,
    shiftName: 'Morning Shift',
    shiftDate: '2026-03-01T00:00:00Z',
    status: 'Reviewed',
    outgoingOperatorGuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    outgoingOperatorName: 'Alice Smith',
    incomingOperatorGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    incomingOperatorName: 'Bob Jones',
    incomingOperatorStatus: 'PendingAcceptance',
    incomingOperatorRespondedAt: null,
    incomingOperatorNotes: null,
    shiftInstanceGuid: SHIFT_INSTANCE_GUID,
    journalGuid: JOURNAL_GUID,
    locationGuid: '66666666-6666-4666-8666-666666666666',
    journalGenerationType: 'AutoGenerate',
    journalName: 'Morning Shift Handover 2026-03-01',
    summary: 'All equipment checked, 2 WOs pending.'
  };

  const acceptedHandover = {
    ...handover,
    incomingOperatorStatus: 'Accepted',
    incomingOperatorRespondedAt: '2026-03-01T08:05:00Z',
    incomingOperatorNotes: 'Handover accepted, all items noted.',
    status: 'Accepted'
  };

  const declinedHandover = {
    ...handover,
    incomingOperatorStatus: 'Declined',
    incomingOperatorRespondedAt: '2026-03-01T08:05:00Z',
    incomingOperatorNotes: 'Missing critical information.',
    status: 'Reviewed'
  };

  const pendingAcceptances = [handover];

  // ---------------------------------------------------------------------------
  // UteamupShiftHandoverAccept
  // ---------------------------------------------------------------------------
  describe('UteamupShiftHandoverAccept tool', () => {
    test('happy path: accepting a reviewed handover moves it to Accepted, not Completed', async () => {
      const response = await call(
        'UteamupShiftHandoverAccept',
        { handoverGuid: HANDOVER_GUID, notes: 'Handover accepted, all items noted.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(acceptedHandover) }] },
            id: 1
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.guid).toBe(HANDOVER_GUID);
      expect(result.incomingOperatorStatus).toBe('Accepted');
      expect(result.status).toBe('Accepted');
    });

    test('accept with notes stores notes in incomingOperatorNotes field', async () => {
      const response = await call(
        'UteamupShiftHandoverAccept',
        { handoverGuid: HANDOVER_GUID, notes: 'Handover accepted, all items noted.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(acceptedHandover) }] },
            id: 2
          }
        }
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.incomingOperatorNotes).toBe('Handover accepted, all items noted.');
    });

    test('accept without notes leaves incomingOperatorNotes as null', async () => {
      const acceptedNoNotes = { ...acceptedHandover, incomingOperatorNotes: null };

      const response = await call(
        'UteamupShiftHandoverAccept',
        { handoverGuid: HANDOVER_GUID },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(acceptedNoNotes) }] },
            id: 3
          }
        }
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.incomingOperatorStatus).toBe('Accepted');
      expect(result.incomingOperatorNotes).toBeNull();
    });

    test('returns error when handover with given GUID is not found', async () => {
      const response = await call(
        'UteamupShiftHandoverAccept',
        { handoverGuid: UNKNOWN_HANDOVER_GUID, notes: 'Accepted.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Handover 999999 not found'
            },
            id: 4
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('returns error when handover has already been accepted', async () => {
      const response = await call(
        'UteamupShiftHandoverAccept',
        { handoverGuid: HANDOVER_GUID, notes: 'Accept again.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Handover 10 has already been accepted'
            },
            id: 5
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('already been accepted');
    });

    test('returns permission denied when current user is not the incoming operator', async () => {
      const response = await call(
        'UteamupShiftHandoverAccept',
        { handoverGuid: HANDOVER_GUID, notes: 'Accepted.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Permission denied: only the incoming operator can accept this handover'
            },
            id: 6
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('incoming operator');
    });

    test('JSON-RPC 2.0 compliance — success response has id and result, no error', async () => {
      const response = await call(
        'UteamupShiftHandoverAccept',
        { handoverGuid: HANDOVER_GUID, notes: 'Handover accepted, all items noted.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(acceptedHandover) }] },
            id: 7
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(7);
    });

    test('incomingOperatorRespondedAt is set to a non-null timestamp upon acceptance', async () => {
      const response = await call(
        'UteamupShiftHandoverAccept',
        { handoverGuid: HANDOVER_GUID, notes: 'Handover accepted, all items noted.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(acceptedHandover) }] },
            id: 8
          }
        }
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.incomingOperatorRespondedAt).not.toBeNull();
      expect(typeof result.incomingOperatorRespondedAt).toBe('string');
      expect(result.incomingOperatorRespondedAt.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftHandoverDeclineAcceptance
  // ---------------------------------------------------------------------------
  describe('UteamupShiftHandoverDeclineAcceptance tool', () => {
    test('declining a handover sets incomingOperatorStatus to Declined', async () => {
      const response = await call(
        'UteamupShiftHandoverDeclineAcceptance',
        { handoverGuid: HANDOVER_GUID, notes: 'Missing critical information.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(declinedHandover) }] },
            id: 10
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.incomingOperatorStatus).toBe('Declined');
    });

    test('decline with notes stores notes in incomingOperatorNotes field', async () => {
      const response = await call(
        'UteamupShiftHandoverDeclineAcceptance',
        { handoverGuid: HANDOVER_GUID, notes: 'Missing critical information.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(declinedHandover) }] },
            id: 11
          }
        }
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.incomingOperatorNotes).toBe('Missing critical information.');
    });

    test('status remains Reviewed after decline — handover is not completed', async () => {
      const response = await call(
        'UteamupShiftHandoverDeclineAcceptance',
        { handoverGuid: HANDOVER_GUID, notes: 'Missing critical information.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(declinedHandover) }] },
            id: 12
          }
        }
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.status).toBe('Reviewed');
      expect(result.status).not.toBe('Completed');
    });

    test('returns error when handover with given GUID is not found', async () => {
      const response = await call(
        'UteamupShiftHandoverDeclineAcceptance',
        { handoverGuid: UNKNOWN_HANDOVER_GUID, notes: 'Declined.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Handover 999999 not found'
            },
            id: 13
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('returns error when handover has already been declined', async () => {
      const response = await call(
        'UteamupShiftHandoverDeclineAcceptance',
        { handoverGuid: HANDOVER_GUID, notes: 'Decline again.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Handover 10 has already been declined'
            },
            id: 14
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('already been declined');
    });

    test('returns permission denied when current user is not the incoming operator', async () => {
      const response = await call(
        'UteamupShiftHandoverDeclineAcceptance',
        { handoverGuid: HANDOVER_GUID, notes: 'Declined.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Permission denied: only the incoming operator can decline this handover'
            },
            id: 15
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('incoming operator');
    });

    test('JSON-RPC 2.0 compliance — success response has id and result, no error', async () => {
      const response = await call(
        'UteamupShiftHandoverDeclineAcceptance',
        { handoverGuid: HANDOVER_GUID, notes: 'Missing critical information.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(declinedHandover) }] },
            id: 16
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(16);
    });

    test('handover must be Reviewed to be declined — error when already Completed', async () => {
      const response = await call(
        'UteamupShiftHandoverDeclineAcceptance',
        { handoverGuid: HANDOVER_GUID, notes: 'Trying to decline a completed handover.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: "Cannot decline handover 10: current status is 'Completed', expected 'Reviewed'"
            },
            id: 17
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Reviewed');
    });

    test('incomingOperatorRespondedAt is set upon decline', async () => {
      const response = await call(
        'UteamupShiftHandoverDeclineAcceptance',
        { handoverGuid: HANDOVER_GUID, notes: 'Missing critical information.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(declinedHandover) }] },
            id: 18
          }
        }
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.incomingOperatorRespondedAt).not.toBeNull();
      expect(typeof result.incomingOperatorRespondedAt).toBe('string');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftHandoverGetPendingAcceptances
  // ---------------------------------------------------------------------------
  describe('UteamupShiftHandoverGetPendingAcceptances tool', () => {
    test('returns list of handovers where incomingOperatorStatus is PendingAcceptance for current user', async () => {
      const response = await call(
        'UteamupShiftHandoverGetPendingAcceptances',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(pendingAcceptances) }] },
            id: 20
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].incomingOperatorStatus).toBe('PendingAcceptance');
    });

    test('returns empty array when current user has no pending acceptances', async () => {
      const response = await call(
        'UteamupShiftHandoverGetPendingAcceptances',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: '[]' }] },
            id: 21
          }
        }
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    test('only returns handovers where the current user is the incomingOperator', async () => {
      const bobPending = [
        { ...handover, incomingOperatorGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', incomingOperatorName: 'Bob Jones' },
        {
          ...handover,
          guid: SECOND_HANDOVER_GUID,
          incomingOperatorGuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          incomingOperatorName: 'Bob Jones'
        }
      ];

      const response = await call(
        'UteamupShiftHandoverGetPendingAcceptances',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(bobPending) }] },
            id: 22
          }
        }
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.length).toBe(2);
      result.forEach(h => {
        expect(h.incomingOperatorGuid).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
        expect(h.guid).toMatch(/^[0-9a-f-]{36}$/i);
        expect(h.tenantGuid).toBe(TENANT_GUID);
        expect(h).not.toHaveProperty('id');
        expect(h).not.toHaveProperty('shiftId');
        expect(h).not.toHaveProperty('shiftInstanceId');
        expect(h).not.toHaveProperty('locationId');
        expect(h).not.toHaveProperty('journalId');
        expect(h).not.toHaveProperty('tenantId');
        expect(h).not.toHaveProperty('externalGuid');
      });
    });

    test('returned handovers include shiftName, shiftDate, and outgoingOperatorName', async () => {
      const response = await call(
        'UteamupShiftHandoverGetPendingAcceptances',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(pendingAcceptances) }] },
            id: 23
          }
        }
      );

      const result = JSON.parse(response.body.result.content[0].text);
      const h = result[0];
      expect(h.shiftName).toBe('Morning Shift');
      expect(h.shiftDate).toBe('2026-03-01T00:00:00Z');
      expect(h.outgoingOperatorName).toBe('Alice Smith');
    });

    test('returns permission error when ShiftHandover.Read permission is missing', async () => {
      const response = await call(
        'UteamupShiftHandoverGetPendingAcceptances',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Permission denied: ShiftHandover.Read required'
            },
            id: 24
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('ShiftHandover.Read');
    });

    test('JSON-RPC 2.0 compliance — success response has id and result, no error', async () => {
      const response = await call(
        'UteamupShiftHandoverGetPendingAcceptances',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(pendingAcceptances) }] },
            id: 25
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(25);
    });

    test('response includes count of pending acceptances matching array length', async () => {
      const multiplePending = [
        handover,
        {
          ...handover,
          guid: SECOND_HANDOVER_GUID,
          shiftName: 'Evening Shift',
          shiftDate: '2026-03-02T00:00:00Z'
        },
        {
          ...handover,
          guid: UNKNOWN_HANDOVER_GUID,
          shiftName: 'Night Shift',
          shiftDate: '2026-03-03T00:00:00Z'
        }
      ];

      const response = await call(
        'UteamupShiftHandoverGetPendingAcceptances',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(multiplePending) }] },
            id: 26
          }
        }
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.length).toBe(3);
    });

    test('returned handovers are sorted by shiftDate descending — newest first', async () => {
      const sortedPending = [
        { ...handover, guid: UNKNOWN_HANDOVER_GUID, shiftDate: '2026-03-03T00:00:00Z' },
        { ...handover, guid: SECOND_HANDOVER_GUID, shiftDate: '2026-03-02T00:00:00Z' },
        handover
      ];

      const response = await call(
        'UteamupShiftHandoverGetPendingAcceptances',
        {},
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(sortedPending) }] },
            id: 27
          }
        }
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.length).toBe(3);
      // Verify descending order: first date >= second date >= third date
      expect(new Date(result[0].shiftDate) >= new Date(result[1].shiftDate)).toBe(true);
      expect(new Date(result[1].shiftDate) >= new Date(result[2].shiftDate)).toBe(true);
    });

    test('request body uses method tools/call with correct tool name', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '[]' }] },
          id: 28
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupShiftHandoverGetPendingAcceptances',
          arguments: {}
        },
        id: 28
      };

      await new Promise((resolve, reject) => {
        const data = JSON.stringify(requestPayload);
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
          },
          rejectUnauthorized: false
        }, (res) => {
          res.on('data', () => {});
          res.on('end', resolve);
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(capturedBody).not.toBeNull();
      expect(capturedBody.method).toBe('tools/call');
      expect(capturedBody.params.name).toBe('UteamupShiftHandoverGetPendingAcceptances');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupShiftHandoverCreate — journal selection fields
  // ---------------------------------------------------------------------------
  describe('UteamupShiftHandoverCreate tool — journal selection', () => {
    test('create with an existing journal uses its public GUID', async () => {
      const handoverWithJournal = {
        ...handover,
        journalGenerationType: 'Existing',
        journalName: 'Existing Journal Q1 2026'
      };

      const response = await call(
        'UteamupShiftHandoverCreate',
        {
          shiftGuid: SHIFT_GUID,
          shiftDate: '2026-03-01',
          summary: 'All equipment checked, 2 WOs pending.',
          journalGuid: JOURNAL_GUID,
          journalGenerationType: 'Existing'
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(handoverWithJournal) }] },
            id: 30
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.journalGuid).toBe(JOURNAL_GUID);
      expect(result.journalGenerationType).toBe('Existing');
      expect(result).not.toHaveProperty('journalId');
    });

    test('create with AutoGenerate returns the generated journal GUID', async () => {
      const handoverAutoGenerate = {
        ...handover,
        journalGenerationType: 'AutoGenerate',
        journalName: 'Morning Shift Handover 2026-03-01'
      };

      const response = await call(
        'UteamupShiftHandoverCreate',
        {
          shiftGuid: SHIFT_GUID,
          shiftDate: '2026-03-01',
          summary: 'All equipment checked, 2 WOs pending.',
          journalGenerationType: 'AutoGenerate',
          journalName: 'Morning Shift Handover 2026-03-01'
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(handoverAutoGenerate) }] },
            id: 31
          }
        }
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.journalGuid).toBe(JOURNAL_GUID);
      expect(result).not.toHaveProperty('journalId');
      expect(result.journalGenerationType).toBe('AutoGenerate');
      expect(typeof result.journalName).toBe('string');
      expect(result.journalName.length).toBeGreaterThan(0);
    });

    test('create with custom journalName stores the provided journal name', async () => {
      const handoverCustomName = {
        ...handover,
        journalGenerationType: 'AutoGenerate',
        journalName: 'My Custom Handover Journal'
      };

      const response = await call(
        'UteamupShiftHandoverCreate',
        {
          shiftGuid: SHIFT_GUID,
          shiftDate: '2026-03-01',
          summary: 'All equipment checked.',
          journalGenerationType: 'AutoGenerate',
          journalName: 'My Custom Handover Journal'
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(handoverCustomName) }] },
            id: 32
          }
        }
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.journalName).toBe('My Custom Handover Journal');
    });

    test('create without journal fields returns only the public journal GUID', async () => {
      const handoverNoJournal = {
        ...handover,
        journalGenerationType: 'AutoGenerate'
      };

      const response = await call(
        'UteamupShiftHandoverCreate',
        {
          shiftGuid: SHIFT_GUID,
          shiftDate: '2026-03-01',
          summary: 'All equipment checked, 2 WOs pending.'
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(handoverNoJournal) }] },
            id: 33
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.journalGuid).toBe(JOURNAL_GUID);
      expect(result).not.toHaveProperty('journalId');
    });

    test('create with shiftInstanceGuid links the handover to the shift instance', async () => {
      const handoverWithInstance = {
        ...handover
      };

      const response = await call(
        'UteamupShiftHandoverCreate',
        {
          shiftGuid: SHIFT_GUID,
          shiftDate: '2026-03-01',
          summary: 'All equipment checked.',
          shiftInstanceGuid: SHIFT_INSTANCE_GUID,
          journalGenerationType: 'AutoGenerate',
          journalName: 'Morning Shift Handover 2026-03-01'
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(handoverWithInstance) }] },
            id: 34
          }
        }
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.shiftInstanceGuid).toBe(SHIFT_INSTANCE_GUID);
      expect(result).not.toHaveProperty('shiftInstanceId');
    });

    test('create without shiftInstanceGuid succeeds when no instance is required', async () => {
      const handoverNoInstance = {
        ...handover,
        shiftInstanceGuid: null
      };

      const response = await call(
        'UteamupShiftHandoverCreate',
        {
          shiftGuid: SHIFT_GUID,
          shiftDate: '2026-03-01',
          summary: 'All equipment checked.'
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(handoverNoInstance) }] },
            id: 35
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.shiftInstanceGuid).toBeNull();
      expect(result).not.toHaveProperty('shiftInstanceId');
    });

    test('default journal generation derives a name from the shift and date', async () => {
      const handoverAutoName = {
        ...handover,
        shiftName: 'Morning Shift',
        shiftDate: '2026-03-01T00:00:00Z',
        journalGenerationType: 'AutoGenerate',
        journalName: 'Morning Shift Handover 2026-03-01'
      };

      const response = await call(
        'UteamupShiftHandoverCreate',
        {
          shiftGuid: SHIFT_GUID,
          shiftDate: '2026-03-01',
          summary: 'All equipment checked.'
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(handoverAutoName) }] },
            id: 36
          }
        }
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.journalName).toContain('Morning Shift');
      expect(result.journalName).toContain('2026-03-01');
    });

    test('returns permission error when ShiftHandover.Create permission is missing', async () => {
      const response = await call(
        'UteamupShiftHandoverCreate',
        {
          shiftGuid: SHIFT_GUID,
          shiftDate: '2026-03-01',
          summary: 'All equipment checked.'
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Permission denied: ShiftHandover.Create required'
            },
            id: 37
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('ShiftHandover.Create');
    });

    test('JSON-RPC 2.0 compliance — success response has id and result, no error', async () => {
      const response = await call(
        'UteamupShiftHandoverCreate',
        {
          shiftGuid: SHIFT_GUID,
          shiftDate: '2026-03-01',
          summary: 'All equipment checked.',
          journalGenerationType: 'AutoGenerate',
          journalName: 'Morning Shift Handover 2026-03-01'
        },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(handover) }] },
            id: 38
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
      expect(response.body.id).toBe(38);
    });
  });

  // ---------------------------------------------------------------------------
  // Explicit review and completion transitions
  // ---------------------------------------------------------------------------
  describe('explicit handover lifecycle transitions', () => {
    test('start review moves a submitted handover to Reviewed', async () => {
      const reviewed = { ...handover, status: 'Reviewed' };
      const response = await call(
        'UteamupShiftHandoverStartReview',
        { handoverGuid: HANDOVER_GUID },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(reviewed) }] },
            id: 70
          }
        }
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.status).toBe('Reviewed');
      expect(result.incomingOperatorStatus).toBe('PendingAcceptance');
    });

    test('complete moves an accepted handover to Completed', async () => {
      const completed = { ...acceptedHandover, status: 'Completed' };
      const response = await call(
        'UteamupShiftHandoverComplete',
        { handoverGuid: HANDOVER_GUID },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(completed) }] },
            id: 71
          }
        }
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.status).toBe('Completed');
      expect(result.incomingOperatorStatus).toBe('Accepted');
    });
  });

  // ---------------------------------------------------------------------------
  // Shared tool definitions for error-handling factories
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupShiftHandoverStartReview', args: { handoverGuid: HANDOVER_GUID } },
    { name: 'UteamupShiftHandoverAccept', args: { handoverGuid: HANDOVER_GUID, notes: 'Accepted.' } },
    { name: 'UteamupShiftHandoverComplete', args: { handoverGuid: HANDOVER_GUID } },
    { name: 'UteamupShiftHandoverDeclineAcceptance', args: { handoverGuid: HANDOVER_GUID, notes: 'Declined.' } },
    { name: 'UteamupShiftHandoverGetPendingAcceptances', args: {} },
    { name: 'UteamupShiftHandoverCreate', args: { shiftGuid: SHIFT_GUID, shiftDate: '2026-03-01', summary: 'Test.' } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);

  // ---------------------------------------------------------------------------
  // Accept / Decline mutual exclusion — state machine correctness
  // ---------------------------------------------------------------------------
  describe('Accept/Decline state machine correctness', () => {
    test('accepted handover remains Accepted, declined handover retains Reviewed', async () => {
      const acceptResponse = await call(
        'UteamupShiftHandoverAccept',
        { handoverGuid: HANDOVER_GUID, notes: 'All good.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(acceptedHandover) }] },
            id: 80
          }
        }
      );

      const acceptedResult = JSON.parse(acceptResponse.body.result.content[0].text);
      expect(acceptedResult.status).toBe('Accepted');

      const declineResponse = await call(
        'UteamupShiftHandoverDeclineAcceptance',
        { handoverGuid: SECOND_HANDOVER_GUID, notes: 'Issues found.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(declinedHandover) }] },
            id: 81
          }
        }
      );

      const declinedResult = JSON.parse(declineResponse.body.result.content[0].text);
      expect(declinedResult.status).toBe('Reviewed');
    });

    test('attempting to accept a declined handover returns an error', async () => {
      const response = await call(
        'UteamupShiftHandoverAccept',
        { handoverGuid: HANDOVER_GUID, notes: 'Trying to accept a declined handover.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: "Cannot accept handover 10: current incomingOperatorStatus is 'Declined'"
            },
            id: 82
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Declined');
    });

    test('attempting to decline an accepted handover returns an error', async () => {
      const response = await call(
        'UteamupShiftHandoverDeclineAcceptance',
        { handoverGuid: HANDOVER_GUID, notes: 'Trying to decline an accepted handover.' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: "Cannot decline handover 10: current incomingOperatorStatus is 'Accepted'"
            },
            id: 83
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Accepted');
    });
  });
});
