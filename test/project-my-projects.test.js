/**
 * Project MyProjects MCP tool tests
 *
 * Covers the UteamupProjectMyProjects tool which proxies to the backend
 * GET /api/project/my-projects endpoint. Verifies that the MCP proxy:
 *   - Forwards tools/call requests as JSON-RPC 2.0
 *   - Handles successful backend responses
 *   - Handles empty result sets
 *   - Handles backend errors (401, 503, JSON-RPC error shape)
 *
 * Pattern mirrors labour-rate.test.js: raw nock-mocked HTTPS calls that
 * simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Project MyProjects MCP Tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_my_projects';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Shared mock data — matches backend MyProjectResponseModel
  // ---------------------------------------------------------------------------
  const turbineOverhaul = {
    id: 5,
    name: 'Turbine Overhaul',
    projectCode: 'TO-5',
    description: 'Annual turbine maintenance',
    status: 1,
    priority: 2,
    completionPercentage: 45,
    startDate: '2026-04-01T00:00:00Z',
    endDate: '2026-07-01T00:00:00Z',
    myWorkorderCount: 5,
  };

  const boilerInspection = {
    id: 2,
    name: 'Boiler Inspection',
    projectCode: 'BI-2',
    description: null,
    status: 1,
    priority: 1,
    completionPercentage: 20,
    startDate: '2026-03-15T00:00:00Z',
    endDate: null,
    myWorkorderCount: 1,
  };

  const mockList = [turbineOverhaul, boilerInspection];

  // ---------------------------------------------------------------------------
  // UteamupProjectMyProjects
  // ---------------------------------------------------------------------------
  describe('UteamupProjectMyProjects tool', () => {
    test('returns the projects the current user is assigned to, ordered by count', async () => {
      const response = await call(
        'UteamupProjectMyProjects',
        {},
        successReply(mockList),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe('Turbine Overhaul');
      expect(data[0].myWorkorderCount).toBe(5);
      expect(data[1].name).toBe('Boiler Inspection');
      expect(data[1].myWorkorderCount).toBe(1);
    });

    test('returns empty list when user has no assigned workorders', async () => {
      const response = await call(
        'UteamupProjectMyProjects',
        {},
        successReply([]),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toEqual([]);
    });

    test('includes the MyWorkorderCount field on every project', async () => {
      const response = await call(
        'UteamupProjectMyProjects',
        {},
        successReply(mockList),
      );

      const data = JSON.parse(response.body.result.content[0].text);
      for (const project of data) {
        expect(project).toHaveProperty('myWorkorderCount');
        expect(typeof project.myWorkorderCount).toBe('number');
        expect(project.myWorkorderCount).toBeGreaterThan(0);
      }
    });

    test('handles backend error responses in JSON-RPC error shape', async () => {
      const response = await call(
        'UteamupProjectMyProjects',
        {},
        errorReply(-32603, 'Internal error: database unavailable'),
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32603);
      expect(response.body.error.message).toContain('database unavailable');
    });

    test('tool takes NO arguments — user identity comes from the API key', async () => {
      // Regression guard: the backend resolves the user from the Bearer token.
      // If someone adds a `userId` arg they will silently let a caller spoof
      // another user's projects (the backend currently ignores such args,
      // but a new arg on this tool would confuse every downstream consumer).
      const response = await call(
        'UteamupProjectMyProjects',
        {},
        successReply(mockList),
      );
      expect(response.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Reusable error suites (JSON-RPC compliance, 401, 503)
  // ---------------------------------------------------------------------------
  const tools = [{ name: 'UteamupProjectMyProjects', args: {} }];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
