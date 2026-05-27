/**
 * WorkorderTemplate "Run schedule now" MCP tool tests (bug c5f9a884).
 *
 * Tool under test:
 *   UteamupWorkorderTemplateRunScheduleNow(scheduleGuid)
 *
 * Validates that the MCP proxy forwards the call as a JSON-RPC 2.0 request to
 * the backend /mcp endpoint, that it returns the created workorder on success,
 * and that it surfaces structured error responses (401 / 404 / 503) without
 * leaking the proxy internals.
 *
 * Pattern mirrors workorder-watchlist.test.js: nock-mocked HTTPS calls.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('WorkorderTemplate Run-Schedule-Now MCP Tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_runschedulenow';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const mockScheduleGuid = '11111111-2222-3333-4444-555555555555';

  const mockGeneratedWorkorder = {
    id: 4242,
    guid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    name: 'Control Room Shift Handover Log',
    ticketId: 'WO-4242',
    status: 0,
    priority: 1,
    startDate: '2026-05-27T08:00:00Z',
    dueDate: '2026-05-28T08:00:00Z'
  };

  describe('UteamupWorkorderTemplateRunScheduleNow tool', () => {
    test('returns the newly generated workorder on success', async () => {
      const response = await call(
        'UteamupWorkorderTemplateRunScheduleNow',
        { scheduleGuid: mockScheduleGuid },
        successReply(mockGeneratedWorkorder)
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data.guid).toBe(mockGeneratedWorkorder.guid);
      expect(data.name).toBe('Control Room Shift Handover Log');
      expect(data.ticketId).toBe('WO-4242');
    });

    test('surfaces a 404 NotFound when the schedule is missing or cross-tenant', async () => {
      const response = await call(
        'UteamupWorkorderTemplateRunScheduleNow',
        { scheduleGuid: '00000000-0000-0000-0000-000000000000' },
        errorReply(-32004, 'Schedule not found for the active tenant.')
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/not found/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Shared compliance & auth tests
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupWorkorderTemplateRunScheduleNow', args: { scheduleGuid: mockScheduleGuid } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
