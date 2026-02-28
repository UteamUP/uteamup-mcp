/**
 * Workforce AI MCP tool tests
 *
 * Tests that Workforce AI MCP tool calls are correctly formed as JSON-RPC 2.0
 * requests and that the MCP proxy handles both successful and error responses
 * from the backend /mcp endpoint gracefully.
 *
 * Tools under test:
 *   UteamupWorkforceAIGetSchedulingSuggestions(dateFrom, dateTo)
 *   UteamupWorkforceAIGetReplacementSuggestion(shiftInstanceId, unavailableUserId)
 *   UteamupWorkforceAIGetWOWorkerMatches(shiftInstanceId)
 *   UteamupWorkforceAIGetShiftBriefing(shiftInstanceId, userId)
 *   UteamupWorkforceAIChat(query, history)
 *
 * Pattern mirrors schedule-ai-tools.test.js: raw nock-mocked HTTPS calls that
 * simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const https = require('https');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Workforce AI MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_workforce_ai_tools';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Mock data
  // ---------------------------------------------------------------------------
  const schedulingSuggestions = [
    {
      shiftInstanceId: 5,
      instanceDate: '2026-03-01T00:00:00Z',
      shiftName: 'Morning Shift',
      suggestedAssignments: [
        {
          userId: 'user-alice-001',
          workforceCategoryId: 1,
          score: 0.92,
          rationale: 'Regular recurring assignment'
        }
      ],
      aiRationale: 'Alice has recurring Monday assignment and matching skills.',
      confidenceScore: 0.92
    }
  ];

  const replacementSuggestion = {
    shiftInstanceId: 5,
    unavailableUserId: 'user-alice-001',
    unavailableUserName: 'Alice Smith',
    candidates: [
      {
        userId: 'user-bob-002',
        userName: 'Bob Jones',
        score: 0.85,
        rationale: 'Same category, available',
        isAlreadyAssigned: false
      },
      {
        userId: 'user-carol-003',
        userName: 'Carol Davis',
        score: 0.72,
        rationale: 'Category member',
        isAlreadyAssigned: false
      }
    ]
  };

  const woWorkerMatches = [
    {
      workOrderId: 100,
      workOrderTitle: 'Fix HVAC',
      matches: [
        {
          userId: 'user-alice-001',
          userName: 'Alice Smith',
          overallScore: 0.88,
          skillScore: 0.9,
          certificationScore: 0.85,
          locationScore: 0.9,
          workloadScore: 0.75,
          rationale: 'Strong skill match'
        }
      ]
    }
  ];

  const shiftBriefing = {
    shiftInstanceId: 5,
    userId: 'user-alice-001',
    userName: 'Alice Smith',
    instanceDate: '2026-03-01T00:00:00Z',
    shiftName: 'Morning Shift',
    summary: 'You have 2 work orders today. Priority: Fix HVAC Unit B. Safety: Use PPE.',
    priorityItems: ['Fix HVAC Unit B'],
    safetyNotes: ['Use PPE when working with electrical panels'],
    assignedWorkOrders: [
      {
        workOrderId: 100,
        title: 'Fix HVAC Unit B',
        priority: '1',
        scheduledDate: '2026-03-01T00:00:00Z'
      }
    ],
    carryOversFromPreviousShift: ['Pending filter replacement for Pump A'],
    generatedAt: '2026-03-01T07:00:00Z'
  };

  const chatResponse = {
    reply: 'You have 2 shifts available next week: Morning Shift on Monday and Wednesday.',
    updatedHistory: [
      {
        role: 'user',
        content: 'What shifts are available next week?',
        timestamp: '2026-03-01T08:00:00Z'
      },
      {
        role: 'assistant',
        content: 'You have 2 shifts available next week: Morning Shift on Monday and Wednesday.',
        timestamp: '2026-03-01T08:00:01Z'
      }
    ]
  };

  // ---------------------------------------------------------------------------
  // UteamupWorkforceAIGetSchedulingSuggestions
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceAIGetSchedulingSuggestions tool', () => {
    test('happy path — returns scheduling suggestions with correct shape', async () => {
      const response = await call(
        'UteamupWorkforceAIGetSchedulingSuggestions',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        successReply(schedulingSuggestions, 1)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const suggestions = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].shiftInstanceId).toBe(5);
      expect(suggestions[0].shiftName).toBe('Morning Shift');
      expect(Array.isArray(suggestions[0].suggestedAssignments)).toBe(true);
      expect(typeof suggestions[0].confidenceScore).toBe('number');
      expect(typeof suggestions[0].aiRationale).toBe('string');
    });

    test('empty result — date range with no shifts returns empty array', async () => {
      const response = await call(
        'UteamupWorkforceAIGetSchedulingSuggestions',
        { dateFrom: '2026-12-24', dateTo: '2026-12-26' },
        successReply([], 2)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const suggestions = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBe(0);
    });

    test('high confidence suggestions — confidenceScore >= 0.9', async () => {
      const highConfidence = [
        { ...schedulingSuggestions[0], confidenceScore: 0.97, aiRationale: 'Very strong match.' }
      ];

      const response = await call(
        'UteamupWorkforceAIGetSchedulingSuggestions',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        successReply(highConfidence, 3)
      );

      const suggestions = JSON.parse(response.body.result.content[0].text);
      expect(suggestions[0].confidenceScore).toBeGreaterThanOrEqual(0.9);
    });

    test('low confidence suggestions — confidenceScore < 0.5', async () => {
      const lowConfidence = [
        { ...schedulingSuggestions[0], confidenceScore: 0.41, aiRationale: 'Weak match, no history.' }
      ];

      const response = await call(
        'UteamupWorkforceAIGetSchedulingSuggestions',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        successReply(lowConfidence, 4)
      );

      const suggestions = JSON.parse(response.body.result.content[0].text);
      expect(suggestions[0].confidenceScore).toBeLessThan(0.5);
    });

    test('permission denied — returns error with permission message', async () => {
      const response = await call(
        'UteamupWorkforceAIGetSchedulingSuggestions',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        errorReply(-32600, 'Permission denied: WorkforceAI.View required', 5)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('WorkforceAI.View');
    });

    test('invalid date format — returns validation error', async () => {
      const response = await call(
        'UteamupWorkforceAIGetSchedulingSuggestions',
        { dateFrom: 'not-a-date', dateTo: '2026-03-07' },
        errorReply(-32602, 'DateFrom must be a valid date string in YYYY-MM-DD format', 6)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('YYYY-MM-DD');
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const id = 7;
      const response = await call(
        'UteamupWorkforceAIGetSchedulingSuggestions',
        { dateFrom: '2026-03-01', dateTo: '2026-03-07' },
        successReply(schedulingSuggestions, id)
      );

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('multiple suggestions returned for multi-day range', async () => {
      const multiDay = [
        { ...schedulingSuggestions[0], shiftInstanceId: 5, instanceDate: '2026-03-02T00:00:00Z' },
        { ...schedulingSuggestions[0], shiftInstanceId: 6, instanceDate: '2026-03-03T00:00:00Z' },
        { ...schedulingSuggestions[0], shiftInstanceId: 7, instanceDate: '2026-03-04T00:00:00Z' }
      ];

      const response = await call(
        'UteamupWorkforceAIGetSchedulingSuggestions',
        { dateFrom: '2026-03-02', dateTo: '2026-03-04' },
        successReply(multiDay, 8)
      );

      const suggestions = JSON.parse(response.body.result.content[0].text);
      expect(suggestions.length).toBe(3);
      expect(suggestions[0].shiftInstanceId).toBe(5);
      expect(suggestions[2].shiftInstanceId).toBe(7);
    });

    test('request includes dateFrom and dateTo in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: '[]' }] },
          id: 9
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupWorkforceAIGetSchedulingSuggestions',
          arguments: { dateFrom: '2026-03-01', dateTo: '2026-03-07' }
        },
        id: 9
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
      expect(capturedBody.params.arguments.dateFrom).toBe('2026-03-01');
      expect(capturedBody.params.arguments.dateTo).toBe('2026-03-07');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceAIGetReplacementSuggestion
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceAIGetReplacementSuggestion tool', () => {
    test('happy path — returns replacement suggestion with candidates ranked by score', async () => {
      const response = await call(
        'UteamupWorkforceAIGetReplacementSuggestion',
        { shiftInstanceId: 5, unavailableUserId: 'user-alice-001' },
        successReply(replacementSuggestion, 10)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.shiftInstanceId).toBe(5);
      expect(result.unavailableUserId).toBe('user-alice-001');
      expect(result.unavailableUserName).toBe('Alice Smith');
      expect(Array.isArray(result.candidates)).toBe(true);
      expect(result.candidates.length).toBe(2);
      expect(result.candidates[0].score).toBeGreaterThan(result.candidates[1].score);
    });

    test('not found — shift instance does not exist returns error', async () => {
      const response = await call(
        'UteamupWorkforceAIGetReplacementSuggestion',
        { shiftInstanceId: 99999, unavailableUserId: 'user-alice-001' },
        errorReply(-32602, 'Shift instance 99999 not found', 11)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('empty result — no replacement candidates available returns empty candidates array', async () => {
      const noCandidates = {
        shiftInstanceId: 5,
        unavailableUserId: 'user-alice-001',
        unavailableUserName: 'Alice Smith',
        candidates: []
      };

      const response = await call(
        'UteamupWorkforceAIGetReplacementSuggestion',
        { shiftInstanceId: 5, unavailableUserId: 'user-alice-001' },
        successReply(noCandidates, 12)
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(result.candidates)).toBe(true);
      expect(result.candidates.length).toBe(0);
    });

    test('permission denied — returns permission error', async () => {
      const response = await call(
        'UteamupWorkforceAIGetReplacementSuggestion',
        { shiftInstanceId: 5, unavailableUserId: 'user-alice-001' },
        errorReply(-32600, 'Permission denied: WorkforceAI.View required', 13)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const id = 14;
      const response = await call(
        'UteamupWorkforceAIGetReplacementSuggestion',
        { shiftInstanceId: 5, unavailableUserId: 'user-alice-001' },
        successReply(replacementSuggestion, id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('multiple candidates — 3 candidates ranked by score descending', async () => {
      const threeCandidates = {
        ...replacementSuggestion,
        candidates: [
          { userId: 'user-bob-002', userName: 'Bob Jones', score: 0.91, rationale: 'Best available', isAlreadyAssigned: false },
          { userId: 'user-carol-003', userName: 'Carol Davis', score: 0.79, rationale: 'Qualified', isAlreadyAssigned: false },
          { userId: 'user-dave-004', userName: 'Dave Wilson', score: 0.64, rationale: 'Fallback option', isAlreadyAssigned: false }
        ]
      };

      const response = await call(
        'UteamupWorkforceAIGetReplacementSuggestion',
        { shiftInstanceId: 5, unavailableUserId: 'user-alice-001' },
        successReply(threeCandidates, 15)
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.candidates.length).toBe(3);
      expect(result.candidates[0].score).toBeGreaterThan(result.candidates[1].score);
      expect(result.candidates[1].score).toBeGreaterThan(result.candidates[2].score);
    });

    test('unavailable user not found in shift — returns descriptive error', async () => {
      const response = await call(
        'UteamupWorkforceAIGetReplacementSuggestion',
        { shiftInstanceId: 5, unavailableUserId: 'user-nonexistent-999' },
        errorReply(-32602, 'User user-nonexistent-999 is not assigned to shift instance 5', 16)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('user-nonexistent-999');
    });

    test('request includes shiftInstanceId and unavailableUserId in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(replacementSuggestion) }] },
          id: 17
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupWorkforceAIGetReplacementSuggestion',
          arguments: { shiftInstanceId: 5, unavailableUserId: 'user-alice-001' }
        },
        id: 17
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
      expect(capturedBody.params.arguments.shiftInstanceId).toBe(5);
      expect(capturedBody.params.arguments.unavailableUserId).toBe('user-alice-001');
    });

    test('candidate marked as already assigned — isAlreadyAssigned flag is surfaced', async () => {
      const withAlreadyAssigned = {
        ...replacementSuggestion,
        candidates: [
          { userId: 'user-bob-002', userName: 'Bob Jones', score: 0.85, rationale: 'Best fit', isAlreadyAssigned: true },
          { userId: 'user-carol-003', userName: 'Carol Davis', score: 0.72, rationale: 'Available', isAlreadyAssigned: false }
        ]
      };

      const response = await call(
        'UteamupWorkforceAIGetReplacementSuggestion',
        { shiftInstanceId: 5, unavailableUserId: 'user-alice-001' },
        successReply(withAlreadyAssigned, 18)
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.candidates[0].isAlreadyAssigned).toBe(true);
      expect(result.candidates[1].isAlreadyAssigned).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceAIGetWOWorkerMatches
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceAIGetWOWorkerMatches tool', () => {
    test('happy path — returns work order worker matches with correct shape', async () => {
      const response = await call(
        'UteamupWorkforceAIGetWOWorkerMatches',
        { shiftInstanceId: 5 },
        successReply(woWorkerMatches, 20)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const results = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(results)).toBe(true);
      expect(results[0].workOrderId).toBe(100);
      expect(results[0].workOrderTitle).toBe('Fix HVAC');
      expect(Array.isArray(results[0].matches)).toBe(true);
      expect(results[0].matches[0].userId).toBe('user-alice-001');
      expect(typeof results[0].matches[0].overallScore).toBe('number');
    });

    test('not found — shift instance does not exist returns error', async () => {
      const response = await call(
        'UteamupWorkforceAIGetWOWorkerMatches',
        { shiftInstanceId: 99999 },
        errorReply(-32602, 'Shift instance 99999 not found', 21)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('empty result — shift instance has no work orders returns empty array', async () => {
      const response = await call(
        'UteamupWorkforceAIGetWOWorkerMatches',
        { shiftInstanceId: 5 },
        successReply([], 22)
      );

      const results = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    test('permission denied — returns permission error', async () => {
      const response = await call(
        'UteamupWorkforceAIGetWOWorkerMatches',
        { shiftInstanceId: 5 },
        errorReply(-32600, 'Permission denied: WorkforceAI.View required', 23)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('WorkforceAI.View');
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const id = 24;
      const response = await call(
        'UteamupWorkforceAIGetWOWorkerMatches',
        { shiftInstanceId: 5 },
        successReply(woWorkerMatches, id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('multiple work orders — all five score dimensions are present', async () => {
      const multipleWO = [
        {
          workOrderId: 100,
          workOrderTitle: 'Fix HVAC',
          matches: [
            { userId: 'user-alice-001', userName: 'Alice Smith', overallScore: 0.88, skillScore: 0.9, certificationScore: 0.85, locationScore: 0.9, workloadScore: 0.75, rationale: 'Strong skill match' }
          ]
        },
        {
          workOrderId: 101,
          workOrderTitle: 'Replace Pump Seal',
          matches: [
            { userId: 'user-bob-002', userName: 'Bob Jones', overallScore: 0.77, skillScore: 0.8, certificationScore: 0.7, locationScore: 0.8, workloadScore: 0.78, rationale: 'Certified and nearby' }
          ]
        }
      ];

      const response = await call(
        'UteamupWorkforceAIGetWOWorkerMatches',
        { shiftInstanceId: 5 },
        successReply(multipleWO, 25)
      );

      const results = JSON.parse(response.body.result.content[0].text);
      expect(results.length).toBe(2);
      const match = results[0].matches[0];
      expect(match).toHaveProperty('skillScore');
      expect(match).toHaveProperty('certificationScore');
      expect(match).toHaveProperty('locationScore');
      expect(match).toHaveProperty('workloadScore');
      expect(match).toHaveProperty('overallScore');
    });

    test('work order with no matching workers returns empty matches array', async () => {
      const noMatches = [
        { workOrderId: 200, workOrderTitle: 'Specialized Chemical Work', matches: [] }
      ];

      const response = await call(
        'UteamupWorkforceAIGetWOWorkerMatches',
        { shiftInstanceId: 5 },
        successReply(noMatches, 26)
      );

      const results = JSON.parse(response.body.result.content[0].text);
      expect(results[0].matches.length).toBe(0);
    });

    test('request includes shiftInstanceId in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(woWorkerMatches) }] },
          id: 27
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupWorkforceAIGetWOWorkerMatches',
          arguments: { shiftInstanceId: 5 }
        },
        id: 27
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
      expect(capturedBody.params.arguments.shiftInstanceId).toBe(5);
    });

    test('high overall score workers appear before lower scored ones', async () => {
      const rankedMatches = [
        {
          workOrderId: 100,
          workOrderTitle: 'Fix HVAC',
          matches: [
            { userId: 'user-alice-001', userName: 'Alice Smith', overallScore: 0.95, skillScore: 0.95, certificationScore: 0.95, locationScore: 0.95, workloadScore: 0.95, rationale: 'Perfect match' },
            { userId: 'user-bob-002', userName: 'Bob Jones', overallScore: 0.60, skillScore: 0.6, certificationScore: 0.6, locationScore: 0.6, workloadScore: 0.6, rationale: 'Adequate' }
          ]
        }
      ];

      const response = await call(
        'UteamupWorkforceAIGetWOWorkerMatches',
        { shiftInstanceId: 5 },
        successReply(rankedMatches, 28)
      );

      const results = JSON.parse(response.body.result.content[0].text);
      expect(results[0].matches[0].overallScore).toBeGreaterThan(results[0].matches[1].overallScore);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceAIGetShiftBriefing
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceAIGetShiftBriefing tool', () => {
    test('happy path — returns full shift briefing with all expected fields', async () => {
      const response = await call(
        'UteamupWorkforceAIGetShiftBriefing',
        { shiftInstanceId: 5, userId: 'user-alice-001' },
        successReply(shiftBriefing, 30)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const briefing = JSON.parse(response.body.result.content[0].text);
      expect(briefing.shiftInstanceId).toBe(5);
      expect(briefing.userId).toBe('user-alice-001');
      expect(briefing.userName).toBe('Alice Smith');
      expect(briefing.shiftName).toBe('Morning Shift');
      expect(typeof briefing.summary).toBe('string');
      expect(briefing.summary.length).toBeGreaterThan(0);
      expect(Array.isArray(briefing.priorityItems)).toBe(true);
      expect(Array.isArray(briefing.safetyNotes)).toBe(true);
      expect(Array.isArray(briefing.assignedWorkOrders)).toBe(true);
      expect(Array.isArray(briefing.carryOversFromPreviousShift)).toBe(true);
      expect(briefing.generatedAt).toBeDefined();
    });

    test('not found — shift instance does not exist returns error', async () => {
      const response = await call(
        'UteamupWorkforceAIGetShiftBriefing',
        { shiftInstanceId: 99999, userId: 'user-alice-001' },
        errorReply(-32602, 'Shift instance 99999 not found', 31)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.result).toBeUndefined();
      expect(response.body.error.message).toContain('not found');
    });

    test('user not assigned to shift — returns error', async () => {
      const response = await call(
        'UteamupWorkforceAIGetShiftBriefing',
        { shiftInstanceId: 5, userId: 'user-nonexistent-999' },
        errorReply(-32602, 'User user-nonexistent-999 is not assigned to shift instance 5', 32)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('user-nonexistent-999');
    });

    test('permission denied — returns permission error', async () => {
      const response = await call(
        'UteamupWorkforceAIGetShiftBriefing',
        { shiftInstanceId: 5, userId: 'user-alice-001' },
        errorReply(-32600, 'Permission denied: WorkforceAI.View required', 33)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const id = 34;
      const response = await call(
        'UteamupWorkforceAIGetShiftBriefing',
        { shiftInstanceId: 5, userId: 'user-alice-001' },
        successReply(shiftBriefing, id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('briefing with no carry overs — carryOversFromPreviousShift is empty array', async () => {
      const noCarryOvers = { ...shiftBriefing, carryOversFromPreviousShift: [] };

      const response = await call(
        'UteamupWorkforceAIGetShiftBriefing',
        { shiftInstanceId: 5, userId: 'user-alice-001' },
        successReply(noCarryOvers, 35)
      );

      const briefing = JSON.parse(response.body.result.content[0].text);
      expect(Array.isArray(briefing.carryOversFromPreviousShift)).toBe(true);
      expect(briefing.carryOversFromPreviousShift.length).toBe(0);
    });

    test('briefing includes work order priority and scheduled date', async () => {
      const response = await call(
        'UteamupWorkforceAIGetShiftBriefing',
        { shiftInstanceId: 5, userId: 'user-alice-001' },
        successReply(shiftBriefing, 36)
      );

      const briefing = JSON.parse(response.body.result.content[0].text);
      const wo = briefing.assignedWorkOrders[0];
      expect(wo.workOrderId).toBe(100);
      expect(wo.title).toBe('Fix HVAC Unit B');
      expect(wo.priority).toBeDefined();
      expect(wo.scheduledDate).toBeDefined();
    });

    test('briefing generatedAt is a valid ISO timestamp string', async () => {
      const response = await call(
        'UteamupWorkforceAIGetShiftBriefing',
        { shiftInstanceId: 5, userId: 'user-alice-001' },
        successReply(shiftBriefing, 37)
      );

      const briefing = JSON.parse(response.body.result.content[0].text);
      expect(typeof briefing.generatedAt).toBe('string');
      expect(new Date(briefing.generatedAt).getTime()).not.toBeNaN();
    });

    test('request includes both shiftInstanceId and userId in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(shiftBriefing) }] },
          id: 38
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupWorkforceAIGetShiftBriefing',
          arguments: { shiftInstanceId: 5, userId: 'user-alice-001' }
        },
        id: 38
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
      expect(capturedBody.params.arguments.shiftInstanceId).toBe(5);
      expect(capturedBody.params.arguments.userId).toBe('user-alice-001');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupWorkforceAIChat
  // ---------------------------------------------------------------------------
  describe('UteamupWorkforceAIChat tool', () => {
    test('happy path — returns AI reply and updated history', async () => {
      const response = await call(
        'UteamupWorkforceAIChat',
        { query: 'What shifts are available next week?', history: [] },
        successReply(chatResponse, 40)
      );

      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();

      const result = JSON.parse(response.body.result.content[0].text);
      expect(typeof result.reply).toBe('string');
      expect(result.reply.length).toBeGreaterThan(0);
      expect(Array.isArray(result.updatedHistory)).toBe(true);
      expect(result.updatedHistory.length).toBe(2);
      expect(result.updatedHistory[0].role).toBe('user');
      expect(result.updatedHistory[1].role).toBe('assistant');
    });

    test('chat with non-empty history — history is preserved and extended', async () => {
      const existingHistory = [
        { role: 'user', content: 'Who is on shift today?', timestamp: '2026-03-01T07:55:00Z' },
        { role: 'assistant', content: 'Alice Smith and Bob Jones are on the Morning Shift today.', timestamp: '2026-03-01T07:55:01Z' }
      ];

      const extendedResponse = {
        reply: 'You have 2 shifts available next week: Morning Shift on Monday and Wednesday.',
        updatedHistory: [
          ...existingHistory,
          { role: 'user', content: 'What shifts are available next week?', timestamp: '2026-03-01T08:00:00Z' },
          { role: 'assistant', content: 'You have 2 shifts available next week: Morning Shift on Monday and Wednesday.', timestamp: '2026-03-01T08:00:01Z' }
        ]
      };

      const response = await call(
        'UteamupWorkforceAIChat',
        { query: 'What shifts are available next week?', history: existingHistory },
        successReply(extendedResponse, 41)
      );

      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.updatedHistory.length).toBe(4);
      expect(result.updatedHistory[0].role).toBe('user');
      expect(result.updatedHistory[2].role).toBe('user');
      expect(result.updatedHistory[3].role).toBe('assistant');
    });

    test('empty query — returns validation error', async () => {
      const response = await call(
        'UteamupWorkforceAIChat',
        { query: '', history: [] },
        errorReply(-32602, 'Query must not be empty', 42)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Query');
    });

    test('permission denied — returns permission error', async () => {
      const response = await call(
        'UteamupWorkforceAIChat',
        { query: 'Who is available on Friday?', history: [] },
        errorReply(-32600, 'Permission denied: WorkforceAI.Chat required', 43)
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Permission denied');
      expect(response.body.error.message).toContain('WorkforceAI.Chat');
    });

    test('JSON-RPC 2.0 compliance — response has id and result, no error', async () => {
      const id = 44;
      const response = await call(
        'UteamupWorkforceAIChat',
        { query: 'What shifts are available next week?', history: [] },
        successReply(chatResponse, id)
      );

      expect(response.body.jsonrpc).toBe('2.0');
      expect(response.body.id).toBe(id);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('history entries have role, content, and timestamp fields', async () => {
      const response = await call(
        'UteamupWorkforceAIChat',
        { query: 'What shifts are available next week?', history: [] },
        successReply(chatResponse, 45)
      );

      const result = JSON.parse(response.body.result.content[0].text);
      for (const entry of result.updatedHistory) {
        expect(entry).toHaveProperty('role');
        expect(entry).toHaveProperty('content');
        expect(entry).toHaveProperty('timestamp');
        expect(['user', 'assistant']).toContain(entry.role);
      }
    });

    test('request includes query and history in params', async () => {
      let capturedBody = null;

      nock(BASE_URL)
        .post('/mcp', (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: { content: [{ type: 'text', text: JSON.stringify(chatResponse) }] },
          id: 46
        }), { 'Content-Type': 'application/json' });

      const requestPayload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'UteamupWorkforceAIChat',
          arguments: { query: 'What shifts are available next week?', history: [] }
        },
        id: 46
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
      expect(capturedBody.params.arguments.query).toBe('What shifts are available next week?');
      expect(Array.isArray(capturedBody.params.arguments.history)).toBe(true);
    });

    test('backend service unavailable — 503 is surfaced without crash', async () => {
      nock(BASE_URL)
        .post('/mcp')
        .reply(503, 'Service Unavailable');

      const status = await new Promise((resolve, reject) => {
        const data = JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'UteamupWorkforceAIChat',
            arguments: { query: 'test', history: [] }
          },
          id: 47
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
  // Shared error-handling tests (JSON-RPC, 401, 503)
  // ---------------------------------------------------------------------------
  const allTools = [
    { name: 'UteamupWorkforceAIGetSchedulingSuggestions', args: { dateFrom: '2026-03-01', dateTo: '2026-03-07' } },
    { name: 'UteamupWorkforceAIGetReplacementSuggestion', args: { shiftInstanceId: 5, unavailableUserId: 'user-alice-001' } },
    { name: 'UteamupWorkforceAIGetWOWorkerMatches', args: { shiftInstanceId: 5 } },
    { name: 'UteamupWorkforceAIGetShiftBriefing', args: { shiftInstanceId: 5, userId: 'user-alice-001' } },
    { name: 'UteamupWorkforceAIChat', args: { query: 'test query', history: [] } }
  ];

  describeJsonRpcCompliance(call, allTools);
  describe401Unauthorized(BASE_URL, allTools);
  describe503ServiceUnavailable(BASE_URL, allTools);
});
