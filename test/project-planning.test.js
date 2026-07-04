/**
 * Project Planning MCP tool tests (phases B1–B4)
 *
 * Covers the project-management planning surface exposed via MCP:
 *   - Stages:        UteamupProjectStageList / UteamupProjectStageCreate
 *   - Risk register: UteamupProjectRiskCreate
 *   - BOM:           UteamupProjectBomList / UteamupProjectBomCreate
 *   - Insights:      UteamupProjectPortfolio / UteamupProjectConflicts
 *   - AI planning:   UteamupProjectSuggestWbs / UteamupProjectApplyWbs /
 *                    UteamupProjectLessonsLearned
 *
 * One representative tool per family — the backend Command/Handler pairs are
 * covered by xUnit; these tests verify that the MCP proxy round-trips each
 * tool's args and result shape as JSON-RPC 2.0 without transformation.
 *
 * Pattern mirrors project-my-projects.test.js: raw nock-mocked HTTPS calls
 * that simulate what the MCP proxy would forward to the backend.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Project Planning MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_project_planning';

  const PROJECT_GUID = 'aaaaaaaa-1111-2222-3333-444444444444';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  // ---------------------------------------------------------------------------
  // Stages
  // ---------------------------------------------------------------------------
  describe('UteamupProjectStageList tool', () => {
    const designStage = {
      guid: '11111111-1111-1111-1111-111111111111',
      projectGuid: PROJECT_GUID,
      name: 'Design',
      order: 1,
      status: 'Completed',
      gateCriteriaJson: null,
      startDate: '2026-05-01T00:00:00Z',
      dueDate: '2026-05-15T00:00:00Z',
      completedAt: '2026-05-14T09:00:00Z',
    };
    const executionStage = {
      guid: '22222222-2222-2222-2222-222222222222',
      projectGuid: PROJECT_GUID,
      name: 'Execution',
      order: 2,
      status: 'InProgress',
      gateCriteriaJson: null,
      startDate: '2026-05-15T00:00:00Z',
      dueDate: '2026-06-30T00:00:00Z',
      completedAt: null,
    };

    test('returns the project stages ordered by position', async () => {
      const response = await call(
        'UteamupProjectStageList',
        { projectGuid: PROJECT_GUID },
        successReply([designStage, executionStage]),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe('Design');
      expect(data[0].order).toBe(1);
      expect(data[1].status).toBe('InProgress');
      // GUIDs-in/integer-ids-out: stage identity is a GUID at the boundary
      expect(data[0].guid).toBe('11111111-1111-1111-1111-111111111111');
      expect(data[0].projectGuid).toBe(PROJECT_GUID);
    });

    test('returns empty list for a project with no stages', async () => {
      const response = await call(
        'UteamupProjectStageList',
        { projectGuid: PROJECT_GUID },
        successReply([]),
      );

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
    });

    test('handles backend error responses in JSON-RPC error shape', async () => {
      const response = await call(
        'UteamupProjectStageList',
        { projectGuid: PROJECT_GUID },
        errorReply(-32603, 'KeyNotFoundException: Project not found in tenant.'),
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32603);
      expect(response.body.error.message).toContain('not found');
    });
  });

  describe('UteamupProjectStageCreate tool', () => {
    test('forwards the stage model verbatim and returns the created stage', async () => {
      const model = {
        name: 'Commissioning',
        order: 3,
        gateCriteriaJson: '{"checks":["handover signed"]}',
        startDate: '2026-07-01T00:00:00Z',
        dueDate: '2026-07-15T00:00:00Z',
      };

      let forwardedParams = null;
      nock(BASE_URL)
        .post('/mcp', body => {
          if (body.method === 'tools/call' && body.params?.name === 'UteamupProjectStageCreate') {
            forwardedParams = body.params.arguments;
            return true;
          }
          return false;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                guid: '33333333-3333-3333-3333-333333333333',
                projectGuid: PROJECT_GUID,
                name: 'Commissioning',
                order: 3,
                status: 'NotStarted',
              }),
            }],
          },
          id: 1,
        }), { 'Content-Type': 'application/json' });

      const https = require('https');
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'UteamupProjectStageCreate', arguments: { projectGuid: PROJECT_GUID, model } },
        id: 1,
      };
      const response = await new Promise((resolve, reject) => {
        const data = JSON.stringify(request);
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
          },
          rejectUnauthorized: false,
        }, (res) => {
          let responseData = '';
          res.on('data', chunk => responseData += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(responseData) }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(response.status).toBe(200);
      // The proxy must forward args verbatim — no renaming, no int ids
      expect(forwardedParams.projectGuid).toBe(PROJECT_GUID);
      expect(forwardedParams.model).toEqual(model);

      const created = JSON.parse(response.body.result.content[0].text);
      expect(created.guid).toBe('33333333-3333-3333-3333-333333333333');
      expect(created.status).toBe('NotStarted');
    });
  });

  // ---------------------------------------------------------------------------
  // Risk register
  // ---------------------------------------------------------------------------
  describe('UteamupProjectRiskCreate tool', () => {
    test('creates a risk and returns the GUID-keyed response', async () => {
      const response = await call(
        'UteamupProjectRiskCreate',
        {
          projectGuid: PROJECT_GUID,
          model: {
            title: 'Long-lead transformer delivery',
            description: 'Vendor quoted 26 weeks',
            category: 'Schedule',
            probability: 4,
            impact: 5,
            mitigationPlan: 'Order early; identify alternate vendor',
          },
        },
        successReply({
          guid: '44444444-4444-4444-4444-444444444444',
          projectGuid: PROJECT_GUID,
          title: 'Long-lead transformer delivery',
          category: 'Schedule',
          probability: 4,
          impact: 5,
          score: 20,
          status: 'Open',
        }),
      );

      expect(response.status).toBe(200);
      const risk = JSON.parse(response.body.result.content[0].text);
      expect(risk.guid).toBe('44444444-4444-4444-4444-444444444444');
      expect(risk.score).toBe(20);
      expect(risk.status).toBe('Open');
    });

    test('surfaces a validation error (probability out of range) as JSON-RPC error', async () => {
      const response = await call(
        'UteamupProjectRiskCreate',
        { projectGuid: PROJECT_GUID, model: { title: 'Bad', probability: 9, impact: 1 } },
        errorReply(-32602, 'ArgumentException: Probability must be between 1 and 5.'),
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32602);
      expect(response.body.error.message).toContain('Probability');
    });
  });

  // ---------------------------------------------------------------------------
  // Workorder links (stage assign + risk mitigation links)
  // ---------------------------------------------------------------------------
  describe('UteamupProjectRiskLinkWorkorder tool', () => {
    const RISK_GUID = '44444444-4444-4444-4444-444444444444';
    const WORKORDER_GUID = '55555555-5555-5555-5555-555555555555';

    test('links a workorder to a risk and returns true', async () => {
      const response = await call(
        'UteamupProjectRiskLinkWorkorder',
        { projectGuid: PROJECT_GUID, riskGuid: RISK_GUID, workorderGuid: WORKORDER_GUID },
        successReply(true),
      );

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body.result.content[0].text)).toBe(true);
    });

    test('surfaces the workorder-not-in-project conflict as JSON-RPC error', async () => {
      const response = await call(
        'UteamupProjectRiskLinkWorkorder',
        { projectGuid: PROJECT_GUID, riskGuid: RISK_GUID, workorderGuid: WORKORDER_GUID },
        errorReply(-32603, 'InvalidOperationException: The workorder must be added to the project before it can be linked to a risk.'),
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32603);
      expect(response.body.error.message).toContain('must be added to the project');
    });
  });

  describe('UteamupProjectRiskListWorkorders tool', () => {
    const RISK_GUID = '44444444-4444-4444-4444-444444444444';

    test('returns the GUID-keyed linked workorders', async () => {
      const response = await call(
        'UteamupProjectRiskListWorkorders',
        { projectGuid: PROJECT_GUID, riskGuid: RISK_GUID },
        successReply([
          { guid: '55555555-5555-5555-5555-555555555555', title: 'Order transformer early', status: 'InProgress' },
        ]),
      );

      expect(response.status).toBe(200);
      const workorders = JSON.parse(response.body.result.content[0].text);
      expect(workorders).toHaveLength(1);
      // GUIDs-in/integer-ids-out: workorder identity is a GUID at the boundary
      expect(workorders[0].guid).toBe('55555555-5555-5555-5555-555555555555');
    });
  });

  // ---------------------------------------------------------------------------
  // Bill of materials
  // ---------------------------------------------------------------------------
  describe('UteamupProjectBomList tool', () => {
    const ITEM_GUID = 'cccccccc-1111-2222-3333-444444444444';
    const partLine = {
      guid: 'dddddddd-1111-2222-3333-444444444444',
      projectGuid: PROJECT_GUID,
      itemType: 'Part',
      itemGuid: ITEM_GUID,
      itemName: 'Bearing 6205-2RS',
      stockItemGuid: 'eeeeeeee-1111-2222-3333-444444444444',
      quantityRequired: 12,
      quantityActual: 4,
      isConsumed: false,
      createdAt: '2026-06-01T09:00:00Z',
      updatedAt: '2026-06-10T09:00:00Z',
    };

    test('returns the project BOM lines with GUID-keyed identity', async () => {
      const response = await call(
        'UteamupProjectBomList',
        { projectGuid: PROJECT_GUID },
        successReply([partLine]),
      );

      expect(response.status).toBe(200);
      const data = JSON.parse(response.body.result.content[0].text);
      expect(data).toHaveLength(1);
      expect(data[0].itemType).toBe('Part');
      expect(data[0].quantityRequired).toBe(12);
      // GUIDs-in/integer-ids-out: line identity + referenced item are GUIDs
      expect(data[0].guid).toBe('dddddddd-1111-2222-3333-444444444444');
      expect(data[0].projectGuid).toBe(PROJECT_GUID);
      expect(data[0].itemGuid).toBe(ITEM_GUID);
      expect(data[0].stockItemGuid).toBe('eeeeeeee-1111-2222-3333-444444444444');
    });

    test('returns empty list for a project with no BOM lines', async () => {
      const response = await call(
        'UteamupProjectBomList',
        { projectGuid: PROJECT_GUID },
        successReply([]),
      );

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
    });

    test('handles backend error responses in JSON-RPC error shape', async () => {
      const response = await call(
        'UteamupProjectBomList',
        { projectGuid: PROJECT_GUID },
        errorReply(-32603, 'UnauthorizedAccessException: Permission denied: ProjectBom.View required'),
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32603);
      expect(response.body.error.message).toContain('ProjectBom.View');
    });
  });

  describe('UteamupProjectBomCreate tool', () => {
    test('forwards the BOM line model verbatim and returns the created line', async () => {
      const model = {
        itemType: 'Part',
        itemGuid: 'cccccccc-1111-2222-3333-444444444444',
        quantityRequired: 12,
      };

      let forwardedParams = null;
      nock(BASE_URL)
        .post('/mcp', body => {
          if (body.method === 'tools/call' && body.params?.name === 'UteamupProjectBomCreate') {
            forwardedParams = body.params.arguments;
            return true;
          }
          return false;
        })
        .reply(200, JSON.stringify({
          jsonrpc: '2.0',
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                guid: 'dddddddd-1111-2222-3333-444444444444',
                projectGuid: PROJECT_GUID,
                itemType: 'Part',
                itemGuid: 'cccccccc-1111-2222-3333-444444444444',
                itemName: 'Bearing 6205-2RS',
                stockItemGuid: 'eeeeeeee-1111-2222-3333-444444444444',
                quantityRequired: 12,
                quantityActual: 0,
                isConsumed: false,
              }),
            }],
          },
          id: 1,
        }), { 'Content-Type': 'application/json' });

      const https = require('https');
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'UteamupProjectBomCreate', arguments: { projectGuid: PROJECT_GUID, model } },
        id: 1,
      };
      const response = await new Promise((resolve, reject) => {
        const data = JSON.stringify(request);
        const req = https.request(`${BASE_URL}/mcp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
          },
          rejectUnauthorized: false,
        }, (res) => {
          let responseData = '';
          res.on('data', chunk => responseData += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(responseData) }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
      });

      expect(response.status).toBe(200);
      // The proxy must forward args verbatim — no renaming, no int ids
      expect(forwardedParams.projectGuid).toBe(PROJECT_GUID);
      expect(forwardedParams.model).toEqual(model);

      const created = JSON.parse(response.body.result.content[0].text);
      expect(created.guid).toBe('dddddddd-1111-2222-3333-444444444444');
      expect(created.itemGuid).toBe('cccccccc-1111-2222-3333-444444444444');
      expect(created.quantityActual).toBe(0);
    });

    test('surfaces an unresolved item GUID as a JSON-RPC error', async () => {
      const response = await call(
        'UteamupProjectBomCreate',
        { projectGuid: PROJECT_GUID, model: { itemType: 'Part', itemGuid: 'ffffffff-1111-2222-3333-444444444444', quantityRequired: 1 } },
        errorReply(-32603, 'KeyNotFoundException: Referenced Part not found in tenant.'),
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32603);
      expect(response.body.error.message).toContain('not found');
    });
  });

  // ---------------------------------------------------------------------------
  // Insights: portfolio + conflicts
  // ---------------------------------------------------------------------------
  describe('UteamupProjectPortfolio tool', () => {
    test('returns the paginated portfolio sorted by schedule risk', async () => {
      const response = await call(
        'UteamupProjectPortfolio',
        { page: 1, pageSize: 50 },
        successReply({
          items: [
            { projectGuid: PROJECT_GUID, name: 'Turbine Overhaul', scheduleRisk: 0.8, budgetBurn: 0.65 },
            { projectGuid: 'bbbbbbbb-1111-2222-3333-444444444444', name: 'Boiler Inspection', scheduleRisk: 0.2, budgetBurn: 0.1 },
          ],
          totalCount: 2,
          page: 1,
          pageSize: 50,
        }),
      );

      expect(response.status).toBe(200);
      const portfolio = JSON.parse(response.body.result.content[0].text);
      expect(portfolio.totalCount).toBe(2);
      expect(portfolio.items[0].scheduleRisk).toBeGreaterThanOrEqual(portfolio.items[1].scheduleRisk);
      expect(portfolio.items[0].projectGuid).toBe(PROJECT_GUID);
    });

    test('returns an empty portfolio page', async () => {
      const response = await call(
        'UteamupProjectPortfolio',
        {},
        successReply({ items: [], totalCount: 0, page: 1, pageSize: 50 }),
      );

      expect(response.status).toBe(200);
      const portfolio = JSON.parse(response.body.result.content[0].text);
      expect(portfolio.items).toEqual([]);
      expect(portfolio.totalCount).toBe(0);
    });

    test('takes NO tenant argument — tenancy comes from the API key', async () => {
      // Regression guard: adding a tenantId/tenantGuid arg to any of these tools
      // would invite cross-tenant spoofing; tenancy is resolved from the Bearer
      // token on the backend.
      const response = await call(
        'UteamupProjectPortfolio',
        { page: 1, pageSize: 10 },
        successReply({ items: [], totalCount: 0, page: 1, pageSize: 10 }),
      );
      expect(response.status).toBe(200);
    });
  });

  describe('UteamupProjectConflicts tool', () => {
    test('returns scheduling conflicts between project and PM workorders', async () => {
      const response = await call(
        'UteamupProjectConflicts',
        { projectGuid: PROJECT_GUID },
        successReply([
          {
            projectWorkorderGuid: '55555555-5555-5555-5555-555555555555',
            projectWorkorderName: 'Replace bearing',
            conflictingWorkorderGuid: '66666666-6666-6666-6666-666666666666',
            conflictingWorkorderName: 'Quarterly PM — Turbine 1',
            sharedAssetGuid: '77777777-7777-7777-7777-777777777777',
            overlapStart: '2026-07-10T00:00:00Z',
            overlapEnd: '2026-07-12T00:00:00Z',
          },
        ]),
      );

      expect(response.status).toBe(200);
      const conflicts = JSON.parse(response.body.result.content[0].text);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].projectWorkorderGuid).toBe('55555555-5555-5555-5555-555555555555');
      expect(conflicts[0].conflictingWorkorderGuid).toBe('66666666-6666-6666-6666-666666666666');
    });

    test('returns empty list when there are no conflicts', async () => {
      const response = await call(
        'UteamupProjectConflicts',
        { projectGuid: PROJECT_GUID },
        successReply([]),
      );

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body.result.content[0].text)).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // AI planning: WBS suggest + apply, lessons learned
  // ---------------------------------------------------------------------------
  describe('UteamupProjectSuggestWbs tool', () => {
    test('returns suggested stages with tasks and the AI quota envelope', async () => {
      const response = await call(
        'UteamupProjectSuggestWbs',
        { projectGuid: PROJECT_GUID },
        successReply({
          stages: [
            {
              name: 'Design',
              order: 1,
              gateCriteria: 'Drawings approved',
              startOffsetDays: 0,
              durationDays: 14,
              tasks: [
                { title: 'Produce P&ID', description: null, estimateMinutes: 960, suggestedOrder: 1, dependsOnIndexes: [] },
                { title: 'Review with ops', description: null, estimateMinutes: 240, suggestedOrder: 2, dependsOnIndexes: [0] },
              ],
            },
          ],
          provider: 'openai',
          creditsCharged: 25,
          remaining: 975,
          quotaBlockedReason: null,
          warnings: [],
          error: null,
        }),
      );

      expect(response.status).toBe(200);
      const suggestion = JSON.parse(response.body.result.content[0].text);
      expect(suggestion.stages).toHaveLength(1);
      expect(suggestion.stages[0].tasks).toHaveLength(2);
      expect(suggestion.stages[0].tasks[1].dependsOnIndexes).toEqual([0]);
      // AI quota envelope must ride the result body (AICreditsGuidelines)
      expect(suggestion.creditsCharged).toBe(25);
      expect(suggestion.remaining).toBe(975);
      expect(suggestion.quotaBlockedReason).toBeNull();
    });

    test('surfaces a quota-blocked suggestion without an error envelope', async () => {
      const response = await call(
        'UteamupProjectSuggestWbs',
        { projectGuid: PROJECT_GUID },
        successReply({
          stages: [],
          provider: null,
          creditsCharged: 0,
          remaining: 0,
          quotaBlockedReason: 'Tenant AI quota exhausted',
          warnings: [],
          error: null,
        }),
      );

      expect(response.status).toBe(200);
      const suggestion = JSON.parse(response.body.result.content[0].text);
      expect(suggestion.stages).toEqual([]);
      expect(suggestion.creditsCharged).toBe(0);
      expect(suggestion.quotaBlockedReason).toBe('Tenant AI quota exhausted');
    });
  });

  describe('UteamupProjectApplyWbs tool', () => {
    test('creates the reviewed stages + workorders and returns their GUIDs', async () => {
      const response = await call(
        'UteamupProjectApplyWbs',
        {
          projectGuid: PROJECT_GUID,
          stages: [
            {
              name: 'Design',
              order: 1,
              gateCriteria: null,
              startOffsetDays: 0,
              durationDays: 14,
              tasks: [{ title: 'Produce P&ID', estimateMinutes: 960, suggestedOrder: 1, dependsOnIndexes: [] }],
            },
          ],
        },
        successReply({
          createdStageGuids: ['88888888-8888-8888-8888-888888888888'],
          createdWorkorderGuids: ['99999999-9999-9999-9999-999999999999'],
          stagesCreated: 1,
          workordersCreated: 1,
        }),
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.stagesCreated).toBe(1);
      expect(result.workordersCreated).toBe(1);
      expect(result.createdStageGuids).toEqual(['88888888-8888-8888-8888-888888888888']);
      expect(result.createdWorkorderGuids).toEqual(['99999999-9999-9999-9999-999999999999']);
    });

    test('rejects an empty stages list as JSON-RPC error', async () => {
      const response = await call(
        'UteamupProjectApplyWbs',
        { projectGuid: PROJECT_GUID, stages: [] },
        errorReply(-32602, 'ArgumentException: At least one stage is required'),
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('At least one stage');
    });
  });

  describe('UteamupProjectLessonsLearned tool', () => {
    test('returns the persisted summary with the AI quota envelope', async () => {
      const response = await call(
        'UteamupProjectLessonsLearned',
        { projectGuid: PROJECT_GUID },
        successReply({
          summary: 'Procurement lead times were the dominant schedule driver…',
          generatedAt: '2026-07-02T10:00:00Z',
          provider: 'openai',
          creditsCharged: 25,
          remaining: 950,
          quotaBlockedReason: null,
          warnings: [],
          error: null,
        }),
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.summary).toContain('Procurement lead times');
      expect(result.generatedAt).toBe('2026-07-02T10:00:00Z');
      expect(result.creditsCharged).toBe(25);
    });

    test('non-completed project returns Error on the body without charging', async () => {
      const response = await call(
        'UteamupProjectLessonsLearned',
        { projectGuid: PROJECT_GUID },
        successReply({
          summary: null,
          generatedAt: null,
          provider: null,
          creditsCharged: 0,
          remaining: 950,
          quotaBlockedReason: null,
          warnings: [],
          error: 'Project is not completed — lessons learned require a completed project.',
        }),
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.summary).toBeNull();
      expect(result.creditsCharged).toBe(0);
      expect(result.error).toContain('not completed');
    });
  });

  describe('UteamupProjectEstimate tool', () => {
    test('returns the estimate, inputs and similar-project summary with the AI quota envelope', async () => {
      const response = await call(
        'UteamupProjectEstimate',
        { projectGuid: PROJECT_GUID },
        successReply({
          estimatedDurationDays: 45,
          estimatedCostLikely: 52000,
          estimatedCostLow: 44000,
          estimatedCostHigh: 68000,
          confidence: 'medium',
          rationale: 'Grounded in 12 workorders and 3 comparable overhauls.',
          assumptions: ['No long-lead parts delay'],
          inputs: { workorderCount: 12, stageCount: 4, workorderEstimatedMinutes: 5760, workorderEstimatedCost: 30000, plannedStartDate: '2026-08-01T00:00:00Z', plannedEndDate: null },
          similarProjects: { count: 3, averageDurationDays: 41.5, averageActualCost: 50500, examples: [{ projectGuid: PROJECT_GUID, name: 'Prior overhaul', durationDays: 40, actualCost: 49000 }] },
          provider: 'googleai',
          creditsCharged: 10,
          remaining: 940,
          quotaBlockedReason: null,
          warnings: [],
          error: null,
        }),
      );

      expect(response.status).toBe(200);
      const estimate = JSON.parse(response.body.result.content[0].text);
      expect(estimate.estimatedDurationDays).toBe(45);
      expect(estimate.estimatedCostLikely).toBe(52000);
      expect(estimate.confidence).toBe('medium');
      expect(estimate.inputs.workorderCount).toBe(12);
      expect(estimate.similarProjects.count).toBe(3);
      expect(estimate.similarProjects.averageActualCost).toBe(50500);
      expect(estimate.creditsCharged).toBe(10);
    });

    test('quota-blocked estimate still carries the free similar-project averages', async () => {
      const response = await call(
        'UteamupProjectEstimate',
        { projectGuid: PROJECT_GUID },
        successReply({
          estimatedDurationDays: 0,
          estimatedCostLikely: 0,
          estimatedCostLow: 0,
          estimatedCostHigh: 0,
          confidence: 'low',
          rationale: null,
          assumptions: [],
          inputs: { workorderCount: 12, stageCount: 4, workorderEstimatedMinutes: 5760, workorderEstimatedCost: 30000, plannedStartDate: null, plannedEndDate: null },
          similarProjects: { count: 3, averageDurationDays: 41.5, averageActualCost: 50500, examples: [] },
          provider: null,
          creditsCharged: 0,
          remaining: 0,
          quotaBlockedReason: 'QuotaExceeded',
          warnings: [],
          error: null,
        }),
      );

      expect(response.status).toBe(200);
      const estimate = JSON.parse(response.body.result.content[0].text);
      expect(estimate.quotaBlockedReason).toBe('QuotaExceeded');
      expect(estimate.estimatedDurationDays).toBe(0);
      expect(estimate.similarProjects.averageActualCost).toBe(50500); // free benchmark still present
    });
  });

  describe('UteamupProjectApplyEstimate tool', () => {
    test('writes the reviewed cost + end date and reports what was applied', async () => {
      const response = await call(
        'UteamupProjectApplyEstimate',
        { projectGuid: PROJECT_GUID, estimate: { estimatedDurationDays: 45, estimatedCost: 52000, applyDuration: true, applyCost: true } },
        successReply({
          durationApplied: true,
          costApplied: true,
          newEndDate: '2026-09-15T00:00:00Z',
          newEstimatedCost: 52000,
        }),
      );

      expect(response.status).toBe(200);
      const result = JSON.parse(response.body.result.content[0].text);
      expect(result.durationApplied).toBe(true);
      expect(result.costApplied).toBe(true);
      expect(result.newEstimatedCost).toBe(52000);
    });
  });

  // ---------------------------------------------------------------------------
  // Reusable error suites (JSON-RPC compliance, 401, 503) — one representative
  // tool per family
  // ---------------------------------------------------------------------------
  const tools = [
    { name: 'UteamupProjectStageList', args: { projectGuid: PROJECT_GUID } },
    { name: 'UteamupProjectStageCreate', args: { projectGuid: PROJECT_GUID, model: { name: 'Design', order: 1 } } },
    { name: 'UteamupProjectRiskCreate', args: { projectGuid: PROJECT_GUID, model: { title: 'Risk', probability: 3, impact: 3 } } },
    { name: 'UteamupProjectBomList', args: { projectGuid: PROJECT_GUID } },
    { name: 'UteamupProjectBomCreate', args: { projectGuid: PROJECT_GUID, model: { itemType: 'Part', itemGuid: 'cccccccc-1111-2222-3333-444444444444', quantityRequired: 5 } } },
    { name: 'UteamupProjectPortfolio', args: { page: 1, pageSize: 50 } },
    { name: 'UteamupProjectConflicts', args: { projectGuid: PROJECT_GUID } },
    { name: 'UteamupProjectSuggestWbs', args: { projectGuid: PROJECT_GUID } },
    { name: 'UteamupProjectApplyWbs', args: { projectGuid: PROJECT_GUID, stages: [{ name: 'Design', order: 1, tasks: [] }] } },
    { name: 'UteamupProjectLessonsLearned', args: { projectGuid: PROJECT_GUID } },
    { name: 'UteamupProjectEstimate', args: { projectGuid: PROJECT_GUID } },
    { name: 'UteamupProjectApplyEstimate', args: { projectGuid: PROJECT_GUID, estimate: { estimatedDurationDays: 30, estimatedCost: 5000, applyDuration: true, applyCost: true } } },
  ];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
