/**
 * Schedule AI / Workforce Planning MCP tool tests (Phase 4)
 *
 * Tests that WorkforcePlanningTools MCP tools are correctly formed as JSON-RPC
 * 2.0 requests and that the MCP proxy handles both successful and error
 * responses from the backend /mcp endpoint gracefully.
 *
 * Tools under test:
 *   UteamupWorkforceSuggestAssignment(workorderGuid)
 *   UteamupWorkforceGetCapacity(teamGuid, startDate, endDate)
 *   UteamupWorkforceGetAvailableTechnicians(date, requiredSkillGuids?, requiredCertificateGuids?, teamGuid?)
 *   UteamupWorkforceExplainAssignment(assignmentGuid)
 *   UteamupWorkforceRankTechniciansForWorkOrder(workorderGuid)
 *   UteamupWorkforceCheckTechnicianAvailability(technicianUserGuid, dateStr)
 *   UteamupWorkforceSuggestWeekPlan(teamGuid, weekStartDate)
 *
 * Pattern mirrors schedule-assignment.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy would forward to the backend.
 */

const nock = require('nock');
const https = require('https');
const { callMcpTool: _callMcpTool } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Schedule AI / Workforce Planning MCP Tools (Phase 4)', () => {
  const BASE_URL = 'https://api.test.com';
  const guid = value => `00000000-0000-0000-0000-${String(value).padStart(12, '0')}`;
  const ACCESS_TOKEN = 'test_access_token_workforce_ai';

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // UteamupWorkforceSuggestAssignment
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceSuggestAssignment tool', () => {
    test('uteamup_workforce_suggest_assignment returns best-match technician for a work order', async () => {
      const mockSuggestion = {
        userGuid: guid(101),
        userName: 'Alice Smith',
        availabilityStatus: 'available',
        scheduledHours: 2.0,
        capacityRemaining: 6.0,
        matchingSkills: [{ skillGuid: guid(12), skillName: 'Electrical' }],
        matchingCertificates: [],
        competencyScore: 93.5
      };

      const response = await call(
        'UteamupWorkforceSuggestAssignment',
        { workorderGuid: guid(42) },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockSuggestion) }] },
            id: 70
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const suggestion = JSON.parse(response.body.result.content[0].text);
      expect(suggestion.userGuid).toBe(guid(101));
      expect(suggestion.availabilityStatus).toBe('available');
      expect(typeof suggestion.competencyScore).toBe('number');
    });

    test('uteamup_workforce_suggest_assignment returns null when no suitable technician found', async () => {
      const response = await call(
        'UteamupWorkforceSuggestAssignment',
        { workorderGuid: guid(99) },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: 'null' }] },
            id: 71
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      const suggestion = JSON.parse(response.body.result.content[0].text);
      expect(suggestion).toBeNull();
    });

    test('uteamup_workforce_suggest_assignment with non-existent workorderGuid returns error', async () => {
      const response = await call(
        'UteamupWorkforceSuggestAssignment',
        { workorderGuid: guid(888888) },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Work order 888888 not found'
            },
            id: 72
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('uteamup_workforce_suggest_assignment request includes workorderGuid in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: 'null' }] },
          id: 73
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupWorkforceSuggestAssignment',
          arguments: { workorderGuid: guid(55) }
        },
        id: 73
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
      expect(capturedBody.params.name).toBe('UteamupWorkforceSuggestAssignment');
      expect(capturedBody.params.arguments.workorderGuid).toBe(guid(55));
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceGetCapacity
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceGetCapacity tool', () => {
    test('uteamup_workforce_get_capacity returns capacity overview for a team', async () => {
      const mockCapacity = {
        teamGuid: guid(3),
        teamName: 'Electrical Team',
        startDate: '2026-02-23',
        endDate: '2026-02-27',
        totalAvailableHours: 160.0,
        totalScheduledHours: 88.0,
        totalRemainingHours: 72.0,
        utilizationPercent: 55.0,
        members: [
          {
            userGuid: guid(101),
            userName: 'Alice Smith',
            availableHours: 40.0,
            scheduledHours: 24.0,
            remainingHours: 16.0,
            utilizationPercent: 60.0
          },
          {
            userGuid: guid(102),
            userName: 'Bob Jones',
            availableHours: 40.0,
            scheduledHours: 16.0,
            remainingHours: 24.0,
            utilizationPercent: 40.0
          }
        ]
      };

      const response = await call(
        'UteamupWorkforceGetCapacity',
        { teamGuid: guid(3), startDate: '2026-02-23', endDate: '2026-02-27' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockCapacity) }] },
            id: 74
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const capacity = JSON.parse(response.body.result.content[0].text);
      expect(capacity.teamGuid).toBe(3);
      expect(capacity.totalAvailableHours).toBe(160.0);
      expect(capacity.utilizationPercent).toBe(55.0);
      expect(Array.isArray(capacity.members)).toBe(true);
      expect(capacity.members.length).toBe(2);
    });

    test('uteamup_workforce_get_capacity returns error for non-existent teamGuid', async () => {
      const response = await call(
        'UteamupWorkforceGetCapacity',
        { teamGuid: guid(777777), startDate: '2026-02-23', endDate: '2026-02-27' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Team 777777 not found'
            },
            id: 75
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('uteamup_workforce_get_capacity returns error for invalid date format', async () => {
      const response = await call(
        'UteamupWorkforceGetCapacity',
        { teamGuid: guid(3), startDate: 'not-a-date', endDate: '2026-02-27' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'StartDate must be a valid date string in YYYY-MM-DD format'
            },
            id: 76
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('YYYY-MM-DD');
    });

    test('uteamup_workforce_get_capacity request includes teamGuid, startDate, endDate in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '{}' }] },
          id: 77
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupWorkforceGetCapacity',
          arguments: { teamGuid: guid(4), startDate: '2026-02-23', endDate: '2026-02-27' }
        },
        id: 77
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
      expect(capturedBody.params.arguments.teamGuid).toBe(guid(4));
      expect(capturedBody.params.arguments.startDate).toBe('2026-02-23');
      expect(capturedBody.params.arguments.endDate).toBe('2026-02-27');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceGetAvailableTechnicians
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceGetAvailableTechnicians tool', () => {
    test('uteamup_workforce_get_available_technicians returns list with capacity data', async () => {
      const mockTechnicians = [
        {
          userGuid: guid(101),
          userName: 'Alice Smith',
          availabilityStatus: 'available',
          scheduledHours: 3.0,
          capacityRemaining: 5.0,
          matchingSkills: [],
          matchingCertificates: []
        },
        {
          userGuid: guid(102),
          userName: 'Bob Jones',
          availabilityStatus: 'available',
          scheduledHours: 0.0,
          capacityRemaining: 8.0,
          matchingSkills: [],
          matchingCertificates: []
        }
      ];

      const response = await call(
        'UteamupWorkforceGetAvailableTechnicians',
        { date: '2026-02-24' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockTechnicians) }] },
            id: 78
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const technicians = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(technicians)).toBe(true);
      expect(technicians.length).toBe(2);
      expect(technicians[0].capacityRemaining).toBe(5.0);
      expect(technicians[1].capacityRemaining).toBe(8.0);
    });

    test('uteamup_workforce_get_available_technicians filters by requiredSkillGuids list', async () => {
      const mockFiltered = [
        {
          userGuid: guid(101),
          userName: 'Alice Smith',
          availabilityStatus: 'available',
          scheduledHours: 1.0,
          capacityRemaining: 7.0,
          matchingSkills: [{ skillGuid: guid(5), skillName: 'Plumbing' }],
          matchingCertificates: []
        }
      ];

      const response = await call(
        'UteamupWorkforceGetAvailableTechnicians',
        { date: '2026-02-24', requiredSkillGuids: [guid(5)] },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockFiltered) }] },
            id: 79
          }
        }
      );

      expect(response.status).toBe(200);
      const technicians = JSON.parse(response.body.result.content[0].text);
      expect(technicians.length).toBe(1);
      expect(technicians[0].matchingSkills[0].skillGuid).toBe(5);
    });

    test('uteamup_workforce_get_available_technicians returns error for invalid date', async () => {
      const response = await call(
        'UteamupWorkforceGetAvailableTechnicians',
        { date: 'bad-date' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Invalid date format. Expected YYYY-MM-DD or ISO8601.'
            },
            id: 80
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('YYYY-MM-DD');
    });

    test('uteamup_workforce_get_available_technicians includes optional filters in request params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '[]' }] },
          id: 81
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupWorkforceGetAvailableTechnicians',
          arguments: {
            date: '2026-02-24',
            requiredSkillGuids: [guid(5), guid(12)],
            requiredCertificateGuids: [guid(3)],
            teamGuid: guid(2)
          }
        },
        id: 81
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
      expect(capturedBody.params.arguments.requiredSkillGuids).toEqual([guid(5), guid(12)]);
      expect(capturedBody.params.arguments.requiredCertificateGuids).toEqual([guid(3)]);
      expect(capturedBody.params.arguments.teamGuid).toBe(guid(2));
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceExplainAssignment
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceExplainAssignment tool', () => {
    test('uteamup_workforce_explain_assignment returns explanation object', async () => {
      const mockExplanation = {
        assignmentGuid: guid(42),
        technicianUserGuid: guid(101),
        technicianName: 'Alice Smith',
        workorderGuid: guid(99),
        workorderTitle: 'Inspect Pump Station A',
        explanation: 'Alice was assigned because she has 5 years of experience with pump maintenance, is available during the scheduled window, and her location (Site B) is closest to the work site.',
        competencyScore: 91.5,
        availabilityScore: 100.0,
        proximityScore: 87.0
      };

      const response = await call(
        'UteamupWorkforceExplainAssignment',
        { assignmentGuid: guid(42) },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockExplanation) }] },
            id: 1
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const content = JSON.parse(response.body.result.content[0].text);
      expect(content.assignmentGuid).toBe(42);
      expect(content.technicianName).toBe('Alice Smith');
      expect(typeof content.explanation).toBe('string');
      expect(content.explanation.length).toBeGreaterThan(0);
    });

    test('uteamup_workforce_explain_assignment with invalid assignmentGuid returns error', async () => {
      const response = await call(
        'UteamupWorkforceExplainAssignment',
        { assignmentGuid: guid(999999) },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Assignment 999999 not found'
            },
            id: 2
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('uteamup_workforce_explain_assignment request includes correct assignmentGuid in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '{}' }] },
          id: 3
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupWorkforceExplainAssignment',
          arguments: { assignmentGuid: guid(77) }
        },
        id: 3
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
      expect(capturedBody.params.name).toBe('UteamupWorkforceExplainAssignment');
      expect(capturedBody.params.arguments.assignmentGuid).toBe(guid(77));
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceRankTechniciansForWorkOrder
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceRankTechniciansForWorkOrder tool', () => {
    test('uteamup_workforce_rank_technicians_for_work_order returns technician list', async () => {
      const mockRankings = [
        {
          rank: 1,
          technicianUserGuid: guid(101),
          technicianName: 'Alice Smith',
          overallScore: 93.2,
          competencyScore: 95.0,
          availabilityScore: 100.0,
          proximityScore: 84.5,
          reason: 'Highest competency and fully available'
        },
        {
          rank: 2,
          technicianUserGuid: guid(102),
          technicianName: 'Bob Jones',
          overallScore: 80.1,
          competencyScore: 78.5,
          availabilityScore: 90.0,
          proximityScore: 72.0,
          reason: 'Good competency but partially booked'
        }
      ];

      const response = await call(
        'UteamupWorkforceRankTechniciansForWorkOrder',
        { workorderGuid: guid(55) },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockRankings) }] },
            id: 4
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const rankings = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(rankings)).toBe(true);
      expect(rankings.length).toBe(2);
      expect(rankings[0].rank).toBe(1);
      expect(rankings[0].technicianName).toBe('Alice Smith');
      expect(rankings[1].rank).toBe(2);
    });

    test('uteamup_workforce_rank_technicians_for_work_order returns empty list when no technicians available', async () => {
      const response = await call(
        'UteamupWorkforceRankTechniciansForWorkOrder',
        { workorderGuid: guid(123) },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: '[]' }] },
            id: 5
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      const rankings = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(rankings)).toBe(true);
      expect(rankings.length).toBe(0);
    });

    test('uteamup_workforce_rank_technicians_for_work_order with non-existent workorderGuid returns error', async () => {
      const response = await call(
        'UteamupWorkforceRankTechniciansForWorkOrder',
        { workorderGuid: guid(888888) },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Work order 888888 not found'
            },
            id: 6
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('not found');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceCheckTechnicianAvailability
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceCheckTechnicianAvailability tool', () => {
    test('uteamup_workforce_check_technician_availability returns availability status', async () => {
      const mockAvailability = {
        technicianUserGuid: guid(103),
        technicianName: 'Charlie Brown',
        date: '2026-03-04',
        isAvailable: true,
        availableSlots: [
          { start: '08:00', end: '12:00', durationMinutes: 240 },
          { start: '14:00', end: '17:00', durationMinutes: 180 }
        ],
        bookedSlots: [
          { start: '12:00', end: '14:00', assignmentGuid: guid(501), workorderTitle: 'Pump Maintenance' }
        ],
        totalAvailableMinutes: 420,
        totalBookedMinutes: 120
      };

      const response = await call(
        'UteamupWorkforceCheckTechnicianAvailability',
        { technicianUserGuid: guid(103), dateStr: '2026-03-04' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockAvailability) }] },
            id: 7
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const availability = JSON.parse(response.body.result.content[0].text);
      expect(availability.technicianUserGuid).toBe(guid(103));
      expect(availability.isAvailable).toBe(true);
      expect(Array.isArray(availability.availableSlots)).toBe(true);
      expect(availability.totalAvailableMinutes).toBe(420);
    });

    test('uteamup_workforce_check_technician_availability returns false when fully booked', async () => {
      const mockFullyBooked = {
        technicianUserGuid: guid(104),
        technicianName: 'Dave Wilson',
        date: '2026-03-05',
        isAvailable: false,
        availableSlots: [],
        bookedSlots: [
          { start: '08:00', end: '17:00', assignmentGuid: guid(600), workorderTitle: 'Full Day Site Inspection' }
        ],
        totalAvailableMinutes: 0,
        totalBookedMinutes: 540
      };

      const response = await call(
        'UteamupWorkforceCheckTechnicianAvailability',
        { technicianUserGuid: guid(104), dateStr: '2026-03-05' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockFullyBooked) }] },
            id: 8
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();

      const availability = JSON.parse(response.body.result.content[0].text);
      expect(availability.isAvailable).toBe(false);
      expect(availability.availableSlots.length).toBe(0);
      expect(availability.totalBookedMinutes).toBe(540);
    });

    test('uteamup_workforce_check_technician_availability with invalid dateStr returns error', async () => {
      const response = await call(
        'UteamupWorkforceCheckTechnicianAvailability',
        { technicianUserGuid: guid(101), dateStr: 'not-a-date' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'DateStr must be a valid date string in YYYY-MM-DD format'
            },
            id: 9
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('YYYY-MM-DD');
    });

    test('uteamup_workforce_check_technician_availability includes both required params in request', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '{}' }] },
          id: 10
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupWorkforceCheckTechnicianAvailability',
          arguments: {
            technicianUserGuid: 'user-eve-005',
            dateStr: '2026-03-06'
          }
        },
        id: 10
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
      expect(capturedBody.params.arguments.technicianUserGuid).toBe('user-eve-005');
      expect(capturedBody.params.arguments.dateStr).toBe('2026-03-06');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceSuggestWeekPlan
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceSuggestWeekPlan tool', () => {
    test('uteamup_workforce_suggest_week_plan returns plan suggestion', async () => {
      const mockWeekPlan = {
        teamGuid: guid(3),
        teamName: 'Electrical Team',
        weekStart: '2026-03-02',
        weekEnd: '2026-03-08',
        summary: 'Suggested plan places 12 assignments across 4 technicians with an estimated utilization of 78%.',
        suggestedAssignments: [
          {
            workorderGuid: guid(10),
            workorderTitle: 'Replace Circuit Breaker B12',
            technicianUserGuid: guid(101),
            technicianName: 'Alice Smith',
            proposedStart: '2026-03-02T09:00:00Z',
            proposedEnd: '2026-03-02T11:00:00Z',
            reasoning: 'Alice is best qualified and available on Monday morning'
          },
          {
            workorderGuid: guid(11),
            workorderTitle: 'Install Emergency Lighting',
            technicianUserGuid: guid(102),
            technicianName: 'Bob Jones',
            proposedStart: '2026-03-03T13:00:00Z',
            proposedEnd: '2026-03-03T16:00:00Z',
            reasoning: 'Bob handled similar work last month; slot fits his Tuesday afternoon'
          }
        ],
        estimatedUtilizationPercent: 78.0,
        unschedulableWorkorders: []
      };

      const response = await call(
        'UteamupWorkforceSuggestWeekPlan',
        { teamGuid: guid(3), weekStartDate: '2026-03-02' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: JSON.stringify(mockWeekPlan) }] },
            id: 11
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const plan = JSON.parse(response.body.result.content[0].text);
      expect(plan.teamGuid).toBe(3);
      expect(typeof plan.summary).toBe('string');
      expect(Array.isArray(plan.suggestedAssignments)).toBe(true);
      expect(plan.suggestedAssignments.length).toBe(2);
      expect(plan.estimatedUtilizationPercent).toBe(78.0);
    });

    test('uteamup_workforce_suggest_week_plan with invalid teamGuid returns error', async () => {
      const response = await call(
        'UteamupWorkforceSuggestWeekPlan',
        { teamGuid: guid(777777), weekStartDate: '2026-03-02' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Team 777777 not found'
            },
            id: 12
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('uteamup_workforce_suggest_week_plan with invalid weekStartDate returns error', async () => {
      const response = await call(
        'UteamupWorkforceSuggestWeekPlan',
        { teamGuid: guid(3), weekStartDate: 'bad-date' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'WeekStartDate must be a valid date string in YYYY-MM-DD format'
            },
            id: 13
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('YYYY-MM-DD');
    });

    test('uteamup_workforce_suggest_week_plan request includes teamGuid and weekStartDate in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '{}' }] },
          id: 14
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupWorkforceSuggestWeekPlan',
          arguments: { teamGuid: guid(5), weekStartDate: '2026-03-09' }
        },
        id: 14
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
      expect(capturedBody.params.arguments.teamGuid).toBe(guid(5));
      expect(capturedBody.params.arguments.weekStartDate).toBe('2026-03-09');
    });
  });

  // ---------------------------------------------------------------------------
  // Shared error-handling coverage (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupWorkforceSuggestAssignment', args: { workorderGuid: guid(1) } },
    { name: 'UteamupWorkforceGetCapacity', args: { teamGuid: guid(1), startDate: '2026-02-23', endDate: '2026-02-27' } },
    { name: 'UteamupWorkforceGetAvailableTechnicians', args: { date: '2026-02-24' } },
    { name: 'UteamupWorkforceExplainAssignment', args: { assignmentGuid: guid(1) } },
    { name: 'UteamupWorkforceRankTechniciansForWorkOrder', args: { workorderGuid: guid(1) } },
    { name: 'UteamupWorkforceCheckTechnicianAvailability', args: { technicianUserGuid: guid(105), dateStr: '2026-03-02' } },
    { name: 'UteamupWorkforceSuggestWeekPlan', args: { teamGuid: guid(1), weekStartDate: '2026-03-02' } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);

  // ---------------------------------------------------------------------------
  // Permission denied handling
  // ---------------------------------------------------------------------------
  describe('Permission denied handling', () => {
    test('workforce tools return permission error when Schedule.Manage permission is missing', async () => {
      const response = await call(
        'UteamupWorkforceSuggestWeekPlan',
        { teamGuid: guid(1), weekStartDate: '2026-03-02' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Permission denied: Schedule.Manage required'
            },
            id: 60
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('Schedule.Manage');
    });

    test('workforce explain tool returns permission error for Schedule.Manage missing', async () => {
      const response = await call(
        'UteamupWorkforceExplainAssignment',
        { assignmentGuid: guid(1) },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Permission denied: Schedule.Manage required'
            },
            id: 61
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Schedule.Manage');
    });
  });
});
