/**
 * Automation runtime MCP tool tests.
 *
 * Covers the GUID-only runtime tools on the backend AutomationTools class:
 *   UteamupAutomationRunsList         → ListRunsAutomationCommand        (POST /api/automation/runs/search)
 *   UteamupAutomationRunGet           → GetRunAutomationCommand          (GET  /api/automation/runs/{runGuid})
 *   UteamupAutomationWorkflowValidate → ValidateWorkflowAutomationCommand (POST /api/automation/by-guid/{guid}/validate)
 *   UteamupAutomationWorkflowPublish  → PublishWorkflowAutomationCommand  (POST /api/automation/by-guid/{guid}/publish)
 *   UteamupAutomationWorkflowGenerate → GenerateWorkflowAutomationCommand (POST /api/automation/generate)
 *
 * The proxy is generic: these tests assert a valid JSON-RPC 2.0 tools/call is forwarded and the
 * backend /mcp reply passes through unchanged - including a publish refusal, which is an answer
 * (published:false) and never an error. Pattern mirrors ai-credit-packages-tools.test.js.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
} = require('./helpers/mcp-error-tests');

describe('Automation runtime MCP Tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_automation_runtime';
  const AUTOMATION_GUID = '99999999-8888-4777-8666-555555555555';
  const RUN_GUID = '11111111-2222-4333-8444-555555555555';
  const APPROVAL_GUID = '22222222-3333-4444-8555-666666666666';
  const AGENT_GUID = '33333333-4444-4555-8666-777777777777';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) => _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  const run = (status) => ({
    guid: RUN_GUID,
    automationGuid: AUTOMATION_GUID,
    automationName: 'Pump 1 overheating',
    workflowVersion: 3,
    status,
    triggerEventKey: 'iot.alert.created',
    triggerEntityType: 'IOTAlert',
    triggerAction: 'Create',
    correlationGuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    depth: 0,
    isDryRun: false,
    startedAtUtc: '2026-09-04T08:00:00Z',
    completedAtUtc: status === 'running' ? null : '2026-09-04T08:00:04Z',
    stepCount: 3,
    failedStepCount: status === 'failed' ? 1 : 0,
    steps: []
  });

  describe('Happy path', () => {
    test('UteamupAutomationRunsList — forwards the status filter and passes the page through', async () => {
      const page = { items: [run('succeeded'), run('failed')], currentPage: 1, pageSize: 25, totalItems: 2, totalPages: 1 };
      const response = await call('UteamupAutomationRunsList', { status: 'failed', pageSize: 25 }, successReply(page));
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.result.content).toBeDefined();
    });

    test('UteamupAutomationRunGet — a run with its steps passes through', async () => {
      const detail = { ...run('running'), steps: [{ guid: 's1', nodeId: 'trigger-1', nodeType: 'trigger', nodeLabel: 'Alert', sequence: 1, status: 'succeeded', attemptCount: 1 }] };
      const response = await call('UteamupAutomationRunGet', { runGuid: RUN_GUID }, successReply(detail));
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });

    test('UteamupAutomationWorkflowValidate — validation errors pass through as a result', async () => {
      const validation = { isValid: false, errors: [{ code: 'needsTrigger', message: 'The graph has no trigger.' }], warnings: [] };
      const response = await call('UteamupAutomationWorkflowValidate', { automationGuid: AUTOMATION_GUID }, successReply(validation));
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });

    test('UteamupAutomationWorkflowPublish — a refusal is an answer, not an error', async () => {
      const refused = { version: 0, unchanged: false, published: false, validation: { isValid: false, errors: [{ code: 'needsTrigger', message: 'The graph has no trigger.' }], warnings: [] } };
      const response = await call('UteamupAutomationWorkflowPublish', { automationGuid: AUTOMATION_GUID, note: 'v2' }, successReply(refused));
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(response.body.error).toBeUndefined();
    });

    test('UteamupAutomationWorkflowGenerate — the drafted graph and its questions pass through', async () => {
      const generation = {
        generationGuid: '77777777-6666-4555-8444-333333333333',
        status: 'ready',
        name: 'Pump 1 overheating',
        assumptions: ['The email goes to ops@acme.com'],
        clarifications: [],
        creditsCharged: 3
      };
      const response = await call('UteamupAutomationWorkflowGenerate', { prompt: 'when pump 1 overheats, email ops@acme.com' }, successReply(generation));
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
    });
    test('UteamupAutomationWorkflowGet — the draft graph passes through', async () => {
      const response = await call('UteamupAutomationWorkflowGet', { automationGuid: AUTOMATION_GUID }, successReply({ workflowDefinitionJson: '{"nodes":[],"edges":[]}' }));
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(JSON.stringify(response.body.result)).toContain('"nodes"');
    });

    test('UteamupAutomationWorkflowSave — the saved graph is echoed back', async () => {
      const graph = '{"nodes":[{"id":"trigger-1","type":"trigger"}],"edges":[]}';
      const response = await call('UteamupAutomationWorkflowSave', { automationGuid: AUTOMATION_GUID, workflowDefinitionJson: graph }, successReply({ workflowDefinitionJson: graph }));
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(JSON.stringify(response.body.result)).toContain('trigger-1');
    });

    test('UteamupAutomationApprovalsList — pending approvals pass through as a page', async () => {
      const approval = { guid: APPROVAL_GUID, runGuid: RUN_GUID, automationGuid: AUTOMATION_GUID, automationName: 'Pump 1 overheating', nodeId: 'approval-1', title: 'Create a work order?', status: 'pending' };
      const response = await call('UteamupAutomationApprovalsList', { status: 'pending' }, successReply({ items: [approval], currentPage: 1, pageSize: 20, totalItems: 1, totalPages: 1 }));
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(JSON.stringify(response.body.result)).toContain('Create a work order?');
    });

    test('UteamupAutomationApprovalDecide — the standing decision passes through', async () => {
      const response = await call('UteamupAutomationApprovalDecide', { requestGuid: APPROVAL_GUID, approve: true, comment: 'Go ahead' }, successReply({ guid: APPROVAL_GUID, status: 'approved', decisionComment: 'Go ahead' }));
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(JSON.stringify(response.body.result)).toContain('Go ahead');
    });

    test('UteamupUpmateAgentsList — agents with their budgets pass through', async () => {
      const response = await call('UteamupUpmateAgentsList', {}, successReply([{ guid: AGENT_GUID, name: 'Alert triage', isEnabled: true, dailyCreditBudget: 200, maxCreditsPerRun: 15, creditsSpentToday: 12 }]));
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(JSON.stringify(response.body.result)).toContain('Alert triage');
    });

    test('UteamupUpmateAgentGet — one agent passes through', async () => {
      const response = await call('UteamupUpmateAgentGet', { agentGuid: AGENT_GUID }, successReply({ guid: AGENT_GUID, name: 'Alert triage', isEnabled: true }));
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(JSON.stringify(response.body.result)).toContain('Alert triage');
    });

    test('UteamupUpmateAgentRun — a spent budget comes back as an answer, not an error', async () => {
      const response = await call('UteamupUpmateAgentRun', { agentGuid: AGENT_GUID, entityType: 'Workorder', entityGuid: RUN_GUID }, successReply({ maxCredits: 15, remaining: 0, quotaBlockedReason: "The agent's daily budget of 200 credits is spent." }));
      expect(response.status).toBe(200);
      expect(response.body.result).toBeDefined();
      expect(JSON.stringify(response.body.result)).toContain('daily budget');
    });
  });

  describe('Error pass-through', () => {
    test('UteamupAutomationRunsList — permission denied is forwarded', async () => {
      const response = await call('UteamupAutomationRunsList', {}, errorReply(403, 'Permission denied: Automation.View required'));
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body).toBeDefined();
    });

    test('UteamupAutomationWorkflowGenerate — an exhausted AI quota is forwarded', async () => {
      const response = await call('UteamupAutomationWorkflowGenerate', { prompt: 'anything' }, errorReply(402, 'AI credit quota exhausted'));
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.body).toBeDefined();
    });
  });

  const complianceTools = [
    { name: 'UteamupAutomationRunsList', args: {} },
    { name: 'UteamupAutomationRunGet', args: { runGuid: RUN_GUID } },
    { name: 'UteamupAutomationWorkflowValidate', args: { automationGuid: AUTOMATION_GUID } },
    { name: 'UteamupAutomationWorkflowPublish', args: { automationGuid: AUTOMATION_GUID } },
    { name: 'UteamupAutomationWorkflowGenerate', args: { prompt: 'when pump 1 overheats, email ops@acme.com' } },
    { name: 'UteamupAutomationWorkflowGet', args: { automationGuid: AUTOMATION_GUID } },
    { name: 'UteamupAutomationWorkflowSave', args: { automationGuid: AUTOMATION_GUID, workflowDefinitionJson: '{}' } },
    { name: 'UteamupAutomationApprovalsList', args: {} },
    { name: 'UteamupAutomationApprovalDecide', args: { requestGuid: APPROVAL_GUID, approve: false } },
    { name: 'UteamupUpmateAgentsList', args: {} },
    { name: 'UteamupUpmateAgentGet', args: { agentGuid: AGENT_GUID } },
    { name: 'UteamupUpmateAgentRun', args: { agentGuid: AGENT_GUID } }
  ];

  describeJsonRpcCompliance(call, complianceTools);
  describe401Unauthorized(BASE_URL, complianceTools);
  describe503ServiceUnavailable(BASE_URL, complianceTools);
});
