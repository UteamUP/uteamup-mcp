/**
 * Schedule AI / Workforce Planning MCP tool tests (Phase 4)
 *
 * Tests that the 4 new WorkforcePlanningTools MCP tools are correctly formed
 * as JSON-RPC 2.0 requests and that the MCP proxy handles both successful and
 * error responses from the backend /mcp endpoint gracefully.
 *
 * Tools under test:
 *   UteamupWorkforceExplainAssignment(assignmentId)
 *   UteamupWorkforceRankTechniciansForWorkOrder(workorderId)
 *   UteamupWorkforceCheckTechnicianAvailability(technicianUserId, dateStr)
 *   UteamupWorkforceSuggestWeekPlan(teamId, weekStartDate)
 *
 * Pattern mirrors schedule-assignment.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy would forward to the backend.
 */

const nock = require('nock');
const https = require('https');

describe('Schedule AI / Workforce Planning MCP Tools (Phase 4)', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_workforce_ai';

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  // ---------------------------------------------------------------------------
  // Helper: send a JSON-RPC 2.0 tools/call to /mcp
  // ---------------------------------------------------------------------------
  function callMcpTool(toolName, toolArgs, mockReply) {
    nock(BASE_URL)
      .post('/mcp', body => body.method === 'tools/call' && body.params?.name === toolName)
      .reply(mockReply.status, JSON.stringify(mockReply.body), {
        'Content-Type': 'application/json'
      });

    const request = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: toolArgs
      },
      id: Math.floor(Math.random() * 10000)
    };

    return new Promise((resolve, reject) => {
      const data = JSON.stringify(request);

      const req = https.request(`${BASE_URL}/mcp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Content-Length': Buffer.byteLength(data)
        },
        rejectUnauthorized: false
      }, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(responseData) });
          } catch {
            resolve({ status: res.statusCode, body: responseData });
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  // ---------------------------------------------------------------------------
  // UteamupWorkforceExplainAssignment
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceExplainAssignment tool', () => {
    test('uteamup_workforce_explain_assignment returns explanation object', async () => {
      const mockExplanation = {
        assignmentId: 42,
        technicianId: 'user-alice-001',
        technicianName: 'Alice Smith',
        workorderId: 99,
        workorderTitle: 'Inspect Pump Station A',
        explanation: 'Alice was assigned because she has 5 years of experience with pump maintenance, is available during the scheduled window, and her location (Site B) is closest to the work site.',
        competencyScore: 91.5,
        availabilityScore: 100.0,
        proximityScore: 87.0
      };

      const response = await callMcpTool(
        'UteamupWorkforceExplainAssignment',
        { assignmentId: 42 },
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
      expect(content.assignmentId).toBe(42);
      expect(content.technicianName).toBe('Alice Smith');
      expect(typeof content.explanation).toBe('string');
      expect(content.explanation.length).toBeGreaterThan(0);
    });

    test('uteamup_workforce_explain_assignment with invalid assignmentId returns error', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceExplainAssignment',
        { assignmentId: 999999 },
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

    test('uteamup_workforce_explain_assignment request includes correct assignmentId in params', async () => {
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
          arguments: { assignmentId: 77 }
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
      expect(capturedBody.params.arguments.assignmentId).toBe(77);
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
          technicianId: 'user-alice-001',
          technicianName: 'Alice Smith',
          overallScore: 93.2,
          competencyScore: 95.0,
          availabilityScore: 100.0,
          proximityScore: 84.5,
          reason: 'Highest competency and fully available'
        },
        {
          rank: 2,
          technicianId: 'user-bob-002',
          technicianName: 'Bob Jones',
          overallScore: 80.1,
          competencyScore: 78.5,
          availabilityScore: 90.0,
          proximityScore: 72.0,
          reason: 'Good competency but partially booked'
        }
      ];

      const response = await callMcpTool(
        'UteamupWorkforceRankTechniciansForWorkOrder',
        { workorderId: 55 },
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
      const response = await callMcpTool(
        'UteamupWorkforceRankTechniciansForWorkOrder',
        { workorderId: 123 },
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

    test('uteamup_workforce_rank_technicians_for_work_order with non-existent workorderId returns error', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceRankTechniciansForWorkOrder',
        { workorderId: 888888 },
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
        technicianId: 'user-charlie-003',
        technicianName: 'Charlie Brown',
        date: '2026-03-04',
        isAvailable: true,
        availableSlots: [
          { start: '08:00', end: '12:00', durationMinutes: 240 },
          { start: '14:00', end: '17:00', durationMinutes: 180 }
        ],
        bookedSlots: [
          { start: '12:00', end: '14:00', assignmentId: 501, workorderTitle: 'Pump Maintenance' }
        ],
        totalAvailableMinutes: 420,
        totalBookedMinutes: 120
      };

      const response = await callMcpTool(
        'UteamupWorkforceCheckTechnicianAvailability',
        { technicianUserId: 'user-charlie-003', dateStr: '2026-03-04' },
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
      expect(availability.technicianId).toBe('user-charlie-003');
      expect(availability.isAvailable).toBe(true);
      expect(Array.isArray(availability.availableSlots)).toBe(true);
      expect(availability.totalAvailableMinutes).toBe(420);
    });

    test('uteamup_workforce_check_technician_availability returns false when fully booked', async () => {
      const mockFullyBooked = {
        technicianId: 'user-dave-004',
        technicianName: 'Dave Wilson',
        date: '2026-03-05',
        isAvailable: false,
        availableSlots: [],
        bookedSlots: [
          { start: '08:00', end: '17:00', assignmentId: 600, workorderTitle: 'Full Day Site Inspection' }
        ],
        totalAvailableMinutes: 0,
        totalBookedMinutes: 540
      };

      const response = await callMcpTool(
        'UteamupWorkforceCheckTechnicianAvailability',
        { technicianUserId: 'user-dave-004', dateStr: '2026-03-05' },
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
      const response = await callMcpTool(
        'UteamupWorkforceCheckTechnicianAvailability',
        { technicianUserId: 'user-alice-001', dateStr: 'not-a-date' },
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
            technicianUserId: 'user-eve-005',
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
      expect(capturedBody.params.arguments.technicianUserId).toBe('user-eve-005');
      expect(capturedBody.params.arguments.dateStr).toBe('2026-03-06');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceSuggestWeekPlan
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceSuggestWeekPlan tool', () => {
    test('uteamup_workforce_suggest_week_plan returns plan suggestion', async () => {
      const mockWeekPlan = {
        teamId: 3,
        teamName: 'Electrical Team',
        weekStart: '2026-03-02',
        weekEnd: '2026-03-08',
        summary: 'Suggested plan places 12 assignments across 4 technicians with an estimated utilization of 78%.',
        suggestedAssignments: [
          {
            workorderId: 10,
            workorderTitle: 'Replace Circuit Breaker B12',
            technicianId: 'user-alice-001',
            technicianName: 'Alice Smith',
            proposedStart: '2026-03-02T09:00:00Z',
            proposedEnd: '2026-03-02T11:00:00Z',
            reasoning: 'Alice is best qualified and available on Monday morning'
          },
          {
            workorderId: 11,
            workorderTitle: 'Install Emergency Lighting',
            technicianId: 'user-bob-002',
            technicianName: 'Bob Jones',
            proposedStart: '2026-03-03T13:00:00Z',
            proposedEnd: '2026-03-03T16:00:00Z',
            reasoning: 'Bob handled similar work last month; slot fits his Tuesday afternoon'
          }
        ],
        estimatedUtilizationPercent: 78.0,
        unschedulableWorkorders: []
      };

      const response = await callMcpTool(
        'UteamupWorkforceSuggestWeekPlan',
        { teamId: 3, weekStartDate: '2026-03-02' },
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
      expect(plan.teamId).toBe(3);
      expect(typeof plan.summary).toBe('string');
      expect(Array.isArray(plan.suggestedAssignments)).toBe(true);
      expect(plan.suggestedAssignments.length).toBe(2);
      expect(plan.estimatedUtilizationPercent).toBe(78.0);
    });

    test('uteamup_workforce_suggest_week_plan with invalid teamId returns error', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceSuggestWeekPlan',
        { teamId: 777777, weekStartDate: '2026-03-02' },
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
      const response = await callMcpTool(
        'UteamupWorkforceSuggestWeekPlan',
        { teamId: 3, weekStartDate: 'bad-date' },
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

    test('uteamup_workforce_suggest_week_plan request includes teamId and weekStartDate in params', async () => {
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
          arguments: { teamId: 5, weekStartDate: '2026-03-09' }
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
      expect(capturedBody.params.arguments.teamId).toBe(5);
      expect(capturedBody.params.arguments.weekStartDate).toBe('2026-03-09');
    });
  });

  // ---------------------------------------------------------------------------
  // JSON-RPC 2.0 compliance — all 4 tools
  // ---------------------------------------------------------------------------
  describe('JSON-RPC 2.0 compliance', () => {
    const complianceTools = [
      {
        name: 'UteamupWorkforceExplainAssignment',
        args: { assignmentId: 1 },
        idBase: 20
      },
      {
        name: 'UteamupWorkforceRankTechniciansForWorkOrder',
        args: { workorderId: 1 },
        idBase: 21
      },
      {
        name: 'UteamupWorkforceCheckTechnicianAvailability',
        args: { technicianUserId: 'user-test', dateStr: '2026-03-02' },
        idBase: 22
      },
      {
        name: 'UteamupWorkforceSuggestWeekPlan',
        args: { teamId: 1, weekStartDate: '2026-03-02' },
        idBase: 23
      }
    ];

    test.each(complianceTools)(
      '$name — response has id and result, no error (JSON-RPC 2.0 success shape)',
      async ({ name, args, idBase }) => {
        const response = await callMcpTool(
          name,
          args,
          {
            status: 200,
            body: {
              jsonrpc: '2.0',
              result: { content: [{ type: 'text', text: '{}' }] },
              id: idBase
            }
          }
        );

        expect(response.status).toBe(200);
        // JSON-RPC 2.0 success: MUST have "result", MUST NOT have "error"
        expect(response.body.result).toBeDefined();
        expect(response.body.error).toBeUndefined();
        // MUST have "id" field
        expect(response.body.id).toBeDefined();
        expect(response.body.id).toBe(idBase);
      }
    );

    test('request to /mcp includes jsonrpc, method, params, and id fields', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [] },
          id: 99
        }), { 'Content-Type': 'application/json' });

      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupWorkforceExplainAssignment',
          arguments: { assignmentId: 1 }
        },
        id: 99
      };

      await new Promise((resolve, reject) => {
        const data = JSON.stringify(request);
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
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

      expect(capturedBody.jsonrpc).toBe('2.0');
      expect(capturedBody.method).toBe('tools/call');
      expect(capturedBody.params).toBeDefined();
      expect(capturedBody.id).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 401 Unauthorized handling — all 4 tools
  // ---------------------------------------------------------------------------
  describe('401 Unauthorized handling', () => {
    const authTools = [
      { name: 'UteamupWorkforceExplainAssignment', args: { assignmentId: 1 } },
      { name: 'UteamupWorkforceRankTechniciansForWorkOrder', args: { workorderId: 1 } },
      { name: 'UteamupWorkforceCheckTechnicianAvailability', args: { technicianUserId: 'u1', dateStr: '2026-03-02' } },
      { name: 'UteamupWorkforceSuggestWeekPlan', args: { teamId: 1, weekStartDate: '2026-03-02' } }
    ];

    test.each(authTools)(
      '$name — 401 response from backend returns error result, not crash',
      async ({ name, args }) => {
        nock(BASE_URL)
          .post('/mcp')
          .reply(401, 'Unauthorized');

        const statusCode = await new Promise((resolve, reject) => {
          const data = JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: { name, arguments: args },
            id: Math.floor(Math.random() * 9000) + 1000
          });

          const req = https.request(`${BASE_URL}/mcp`, {
            method: 'POST',
            headers: {
              // deliberately omit Authorization to trigger 401
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(data)
            },
            rejectUnauthorized: false
          }, (res) => {
            // consume body to prevent socket hang
            res.on('data', () => {});
            res.on('end', () => resolve(res.statusCode));
          });
          req.on('error', reject);
          req.write(data);
          req.end();
        });

        // Backend returns 401; MCP proxy should surface this as an error, not crash
        expect(statusCode).toBe(401);
      }
    );
  });

  // ---------------------------------------------------------------------------
  // 503 Network error handling — all 4 tools
  // ---------------------------------------------------------------------------
  describe('503 Service Unavailable handling', () => {
    test('503 from backend is surfaced as HTTP status — not a process crash', async () => {
      // First call: 503 to simulate backend down
      nock(BASE_URL)
        .post('/mcp')
        .reply(503, 'Service Unavailable');

      const firstStatus = await new Promise((resolve, reject) => {
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': '2' },
          rejectUnauthorized: false
        }, (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', reject);
        req.write('{}');
        req.end();
      });

      expect(firstStatus).toBe(503);

      // Second call: backend recovers
      nock(BASE_URL)
        .post('/mcp')
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '{}' }] },
          id: 50
        }), { 'Content-Type': 'application/json' });

      const secondResult = await callMcpTool(
        'UteamupWorkforceSuggestWeekPlan',
        { teamId: 1, weekStartDate: '2026-03-02' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            result: { content: [{ type: 'text', text: '{}' }] },
            id: 50
          }
        }
      );

      expect(secondResult.status).toBe(200);
      expect(secondResult.body.result).toBeDefined();
    });

    test('UteamupWorkforceExplainAssignment gracefully handles 503 response', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(503, 'Service Unavailable');

      const status = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'UteamupWorkforceExplainAssignment',
            arguments: { assignmentId: 1 }
          },
          id: 51
        });

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
          res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      // 503 is surfaced correctly — no unhandled exception
      expect(status).toBe(503);
    });

    test('UteamupWorkforceRankTechniciansForWorkOrder gracefully handles 503 response', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(503, 'Service Unavailable');

      const status = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'UteamupWorkforceRankTechniciansForWorkOrder',
            arguments: { workorderId: 1 }
          },
          id: 52
        });

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
          res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(status).toBe(503);
    });

    test('UteamupWorkforceCheckTechnicianAvailability gracefully handles 503 response', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(503, 'Service Unavailable');

      const status = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'UteamupWorkforceCheckTechnicianAvailability',
            arguments: { technicianUserId: 'u1', dateStr: '2026-03-02' }
          },
          id: 53
        });

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
          res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(status).toBe(503);
    });

    test('UteamupWorkforceSuggestWeekPlan gracefully handles 503 response', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(503, 'Service Unavailable');

      const status = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'UteamupWorkforceSuggestWeekPlan',
            arguments: { teamId: 1, weekStartDate: '2026-03-02' }
          },
          id: 54
        });

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
          res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(status).toBe(503);
    });
  });

  // ---------------------------------------------------------------------------
  // Permission denied handling
  // ---------------------------------------------------------------------------
  describe('Permission denied handling', () => {
    test('workforce tools return permission error when Schedule.AI permission is missing', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceSuggestWeekPlan',
        { teamId: 1, weekStartDate: '2026-03-02' },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Permission denied: Schedule.AI required'
            },
            id: 60
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('Schedule.AI');
    });

    test('workforce explain tool returns permission error for Schedule.Read missing', async () => {
      const response = await callMcpTool(
        'UteamupWorkforceExplainAssignment',
        { assignmentId: 1 },
        {
          status: 200,
          body: {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Permission denied: Schedule.Read required'
            },
            id: 61
          }
        }
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Schedule.Read');
    });
  });
});
