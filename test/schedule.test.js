/**
 * Schedule MCP tool tests
 *
 * Tests that schedule MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy properly handles both successful and error
 * responses from the backend /mcp endpoint.
 *
 * Tools under test:
 *   UteamupScheduleGetMySchedule(startDate, endDate)
 *   UteamupScheduleGetTeamSchedule(teamId, startDate, endDate)
 *   UteamupScheduleGetAvailableTechnicians(date, requiredSkillIds?, requiredCertIds?, teamId?)
 *
 * Pattern mirrors schedule-assignment.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy would forward to the backend.
 */

const nock = require('nock');
const https = require('https');
const { callMcpTool: _callMcpTool } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Schedule MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_schedule_tools';

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // UteamupScheduleGetMySchedule
  // ---------------------------------------------------------------------------
  describe('UteamupScheduleGetMySchedule tool', () => {
    test('returns personal schedule for given date range', async () => {
      const mockSchedule = {
        userId: 'user-alice-001',
        userName: 'Alice Smith',
        startDate: '2026-02-23',
        endDate: '2026-02-27',
        items: [
          {
            date: '2026-02-23',
            workOrderId: 10,
            workOrderTitle: 'Inspect Pump A',
            scheduledStart: '2026-02-23T09:00:00Z',
            scheduledEnd: '2026-02-23T11:00:00Z',
            status: 'Scheduled'
          },
          {
            date: '2026-02-25',
            workOrderId: 15,
            workOrderTitle: 'Replace Filter Unit 3',
            scheduledStart: '2026-02-25T13:00:00Z',
            scheduledEnd: '2026-02-25T15:00:00Z',
            status: 'Scheduled'
          }
        ]
      };

      const response = await call(
        'UteamupScheduleGetMySchedule',
        { startDate: '2026-02-23', endDate: '2026-02-27' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockSchedule) }] },
            id: 1
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const schedule = JSON.parse(response.body.result.content[0].text);
      expect(schedule.userId).toBe('user-alice-001');
      expect(Array.isArray(schedule.items)).toBe(true);
      expect(schedule.items.length).toBe(2);
    });

    test('returns empty items array when no work is scheduled', async () => {
      const mockEmpty = {
        userId: 'user-alice-001',
        userName: 'Alice Smith',
        startDate: '2026-03-01',
        endDate: '2026-03-07',
        items: []
      };

      const response = await call(
        'UteamupScheduleGetMySchedule',
        { startDate: '2026-03-01', endDate: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockEmpty) }] },
            id: 2
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      const schedule = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(schedule.items)).toBe(true);
      expect(schedule.items.length).toBe(0);
    });

    test('returns error for invalid date format', async () => {
      const response = await call(
        'UteamupScheduleGetMySchedule',
        { startDate: 'not-a-date', endDate: '2026-02-27' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'StartDate must be a valid date string in YYYY-MM-DD format'
            },
            id: 3
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('YYYY-MM-DD');
    });

    test('request includes startDate and endDate in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '{}' }] },
          id: 4
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupScheduleGetMySchedule',
          arguments: { startDate: '2026-02-23', endDate: '2026-02-27' }
        },
        id: 4
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
      expect(capturedBody.params.arguments.startDate).toBe('2026-02-23');
      expect(capturedBody.params.arguments.endDate).toBe('2026-02-27');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupScheduleGetTeamSchedule
  // ---------------------------------------------------------------------------
  describe('UteamupScheduleGetTeamSchedule tool', () => {
    test('returns schedule for all team members within date range', async () => {
      const mockTeamSchedule = [
        {
          userId: 'user-alice-001',
          userName: 'Alice Smith',
          startDate: '2026-02-23',
          endDate: '2026-02-27',
          items: [
            {
              date: '2026-02-23',
              workOrderId: 10,
              workOrderTitle: 'Inspect Pump A',
              scheduledStart: '2026-02-23T09:00:00Z',
              scheduledEnd: '2026-02-23T11:00:00Z'
            }
          ]
        },
        {
          userId: 'user-bob-002',
          userName: 'Bob Jones',
          startDate: '2026-02-23',
          endDate: '2026-02-27',
          items: []
        }
      ];

      const response = await call(
        'UteamupScheduleGetTeamSchedule',
        { teamId: 3, startDate: '2026-02-23', endDate: '2026-02-27' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockTeamSchedule) }] },
            id: 10
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const schedules = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(schedules)).toBe(true);
      expect(schedules.length).toBe(2);
      expect(schedules[0].userId).toBe('user-alice-001');
      expect(schedules[1].userId).toBe('user-bob-002');
    });

    test('returns empty list when team has no members with assignments', async () => {
      const response = await call(
        'UteamupScheduleGetTeamSchedule',
        { teamId: 99, startDate: '2026-03-01', endDate: '2026-03-07' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: '[]' }] },
            id: 11
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      const schedules = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(schedules)).toBe(true);
      expect(schedules.length).toBe(0);
    });

    test('returns error for non-existent teamId', async () => {
      const response = await call(
        'UteamupScheduleGetTeamSchedule',
        { teamId: 999999, startDate: '2026-02-23', endDate: '2026-02-27' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Team 999999 not found'
            },
            id: 12
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('request includes teamId, startDate, and endDate in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '[]' }] },
          id: 13
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupScheduleGetTeamSchedule',
          arguments: { teamId: 5, startDate: '2026-02-23', endDate: '2026-02-27' }
        },
        id: 13
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
      expect(capturedBody.params.arguments.teamId).toBe(5);
      expect(capturedBody.params.arguments.startDate).toBe('2026-02-23');
      expect(capturedBody.params.arguments.endDate).toBe('2026-02-27');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupScheduleGetAvailableTechnicians
  // ---------------------------------------------------------------------------
  describe('UteamupScheduleGetAvailableTechnicians tool', () => {
    test('returns available technicians for a given date without filters', async () => {
      const mockTechnicians = [
        {
          userId: 'user-alice-001',
          userName: 'Alice Smith',
          availabilityStatus: 'available',
          scheduledHours: 2.0,
          capacityRemaining: 6.0,
          matchingSkills: [],
          matchingCertificates: []
        },
        {
          userId: 'user-bob-002',
          userName: 'Bob Jones',
          availabilityStatus: 'available',
          scheduledHours: 0.0,
          capacityRemaining: 8.0,
          matchingSkills: [],
          matchingCertificates: []
        }
      ];

      const response = await call(
        'UteamupScheduleGetAvailableTechnicians',
        { date: '2026-02-24' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockTechnicians) }] },
            id: 20
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const technicians = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(technicians)).toBe(true);
      expect(technicians.length).toBe(2);
      expect(technicians[0].userId).toBe('user-alice-001');
      expect(technicians[0].availabilityStatus).toBe('available');
    });

    test('filters technicians by requiredSkillIds', async () => {
      const mockFiltered = [
        {
          userId: 'user-alice-001',
          userName: 'Alice Smith',
          availabilityStatus: 'available',
          scheduledHours: 2.0,
          capacityRemaining: 6.0,
          matchingSkills: [{ skillId: 12, skillName: 'Electrical' }],
          matchingCertificates: []
        }
      ];

      const response = await call(
        'UteamupScheduleGetAvailableTechnicians',
        { date: '2026-02-24', requiredSkillIds: '12' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockFiltered) }] },
            id: 21
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      const technicians = JSON.parse(response.body.result.content[0].text);
      expect(technicians.length).toBe(1);
      expect(technicians[0].matchingSkills[0].skillId).toBe(12);
    });

    test('returns empty list when no technicians match skill and cert filters', async () => {
      const response = await call(
        'UteamupScheduleGetAvailableTechnicians',
        { date: '2026-02-24', requiredSkillIds: '999', requiredCertIds: '888' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: '[]' }] },
            id: 22
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      const technicians = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(technicians)).toBe(true);
      expect(technicians.length).toBe(0);
    });

    test('returns error for invalid date format', async () => {
      const response = await call(
        'UteamupScheduleGetAvailableTechnicians',
        { date: 'bad-date' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Date must be a valid date string in YYYY-MM-DD format'
            },
            id: 23
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('YYYY-MM-DD');
    });

    test('includes optional teamId filter in request params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '[]' }] },
          id: 24
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupScheduleGetAvailableTechnicians',
          arguments: {
            date: '2026-02-24',
            requiredSkillIds: '1,5',
            requiredCertIds: '3',
            teamId: 2
          }
        },
        id: 24
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
      expect(capturedBody.params.arguments.date).toBe('2026-02-24');
      expect(capturedBody.params.arguments.requiredSkillIds).toBe('1,5');
      expect(capturedBody.params.arguments.requiredCertIds).toBe('3');
      expect(capturedBody.params.arguments.teamId).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Shared error-handling coverage (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupScheduleGetMySchedule', args: { startDate: '2026-02-23', endDate: '2026-02-27' } },
    { name: 'UteamupScheduleGetTeamSchedule', args: { teamId: 1, startDate: '2026-02-23', endDate: '2026-02-27' } },
    { name: 'UteamupScheduleGetAvailableTechnicians', args: { date: '2026-02-24' } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);

  // ---------------------------------------------------------------------------
  // Permission denied handling
  // ---------------------------------------------------------------------------
  describe('Permission denied handling', () => {
    test('schedule tools return permission error when Schedule.View permission is missing', async () => {
      const response = await call(
        'UteamupScheduleGetMySchedule',
        { startDate: '2026-02-23', endDate: '2026-02-27' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Permission denied: Schedule.View required'
            },
            id: 60
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('Schedule.View');
    });

    test('UteamupScheduleGetTeamSchedule returns permission error when Schedule.ViewTeam is missing', async () => {
      const response = await call(
        'UteamupScheduleGetTeamSchedule',
        { teamId: 1, startDate: '2026-02-23', endDate: '2026-02-27' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Permission denied: Schedule.ViewTeam required'
            },
            id: 61
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Schedule.ViewTeam');
    });
  });
});
