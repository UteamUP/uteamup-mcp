/**
 * Project template MCP tool tests
 *
 * Tools under test (backend ProjectTools):
 *   UteamupProjectTemplateList()
 *   UteamupProjectCreateFromTemplate(templateGuid, name, startDateUtc, ownerGuid, ...optional)
 *   UteamupProjectSaveAsTemplate(projectGuid, name, projectCode?, description?, workorderGuids?)
 *   UteamupProjectTemplateAddWorkorderTemplates(projectGuid, model)
 *
 * Project templates are projects flagged as templates. The proxy must forward every
 * argument verbatim (GUID references only, never a tenant or user identifier) and
 * surface backend errors without crashing.
 *
 * Pattern mirrors project-my-projects.test.js: nock-mocked HTTPS calls.
 */

'use strict';

const nock = require('nock');
const { callMcpTool: _callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Project template MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_project_templates';
  const TEMPLATE_GUID = '11111111-1111-4111-8111-111111111111';
  const PROJECT_GUID = '22222222-2222-4222-8222-222222222222';
  const OWNER_GUID = '33333333-3333-4333-8333-333333333333';
  const WORKORDER_GUID = '44444444-4444-4444-8444-444444444444';
  const WORKORDER_TEMPLATE_GUID = '55555555-5555-4555-8555-555555555555';
  const SECOND_WORKORDER_TEMPLATE_GUID = '66666666-6666-4666-8666-666666666666';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, expectedArgs);

  const parse = (response) => JSON.parse(response.body.result.content[0].text);

  // Matches backend ProjectTemplateResponseModel: GUID-only, no integer id.
  const template = {
    externalGuid: TEMPLATE_GUID,
    name: 'Turbine overhaul template',
    projectCode: 'TPL-TO',
    description: 'Annual turbine overhaul plan',
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-03-01T00:00:00Z',
    status: 0,
    priority: 2,
    budget: 50000,
    isTemplate: true,
    projectOwnerGuid: OWNER_GUID,
    workorderGuids: [],
    tagGuids: [],
    documentGuids: [],
  };

  // ---------------------------------------------------------------------------
  // UteamupProjectTemplateList
  // ---------------------------------------------------------------------------
  describe('UteamupProjectTemplateList tool', () => {
    test('returns GUID-only templates and forwards no tenant or user arguments', async () => {
      const response = await call('UteamupProjectTemplateList', {}, successReply([template]), {});

      expect(response.status).toBe(200);
      const data = parse(response);
      expect(data).toHaveLength(1);
      expect(data[0].externalGuid).toBe(TEMPLATE_GUID);
      expect(data[0].isTemplate).toBe(true);
      expect(data[0]).not.toHaveProperty('id');
    });

    test('returns an empty list when the tenant has no templates', async () => {
      const response = await call('UteamupProjectTemplateList', {}, successReply([]));

      expect(parse(response)).toEqual([]);
    });

    test('handles backend errors in JSON-RPC error shape', async () => {
      const response = await call(
        'UteamupProjectTemplateList',
        {},
        errorReply(-32603, 'Permission denied: Project.View required'),
      );

      expect(response.body.error.code).toBe(-32603);
      expect(response.body.error.message).toContain('Project.View');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupProjectCreateFromTemplate
  // ---------------------------------------------------------------------------
  describe('UteamupProjectCreateFromTemplate tool', () => {
    const args = {
      templateGuid: TEMPLATE_GUID,
      name: 'Turbine overhaul 2027',
      startDateUtc: '2027-03-01T00:00:00Z',
      ownerGuid: OWNER_GUID,
      description: 'Created from the overhaul template',
      projectCode: 'TO-2027',
      endDateUtc: '2027-06-01T00:00:00Z',
      priority: 2,
      budget: 75000,
      customerGuid: '77777777-7777-4777-8777-777777777777',
      locationGuid: '88888888-8888-4888-8888-888888888888',
      assetGroupGuid: '99999999-9999-4999-8999-999999999999',
    };

    test('forwards every argument verbatim and returns the created project', async () => {
      const created = {
        externalGuid: PROJECT_GUID,
        name: args.name,
        projectCode: args.projectCode,
        isTemplate: false,
        projectOwnerGuid: OWNER_GUID,
      };
      const response = await call('UteamupProjectCreateFromTemplate', args, successReply(created), args);

      expect(response.status).toBe(200);
      const data = parse(response);
      expect(data.externalGuid).toBe(PROJECT_GUID);
      expect(data.isTemplate).toBe(false);
    });

    test('surfaces a missing template as a JSON-RPC error', async () => {
      const response = await call(
        'UteamupProjectCreateFromTemplate',
        args,
        errorReply(-32603, `Template project with GUID ${TEMPLATE_GUID} not found.`),
      );

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toMatch(/not found/i);
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupProjectSaveAsTemplate
  // ---------------------------------------------------------------------------
  describe('UteamupProjectSaveAsTemplate tool', () => {
    const args = {
      projectGuid: PROJECT_GUID,
      name: 'Turbine overhaul template',
      projectCode: 'TPL-TO',
      description: 'Saved from the 2026 overhaul',
      workorderGuids: [WORKORDER_GUID],
    };

    test('forwards the selected workorders and returns the new template', async () => {
      const response = await call('UteamupProjectSaveAsTemplate', args, successReply(template), args);

      const data = parse(response);
      expect(data.externalGuid).toBe(TEMPLATE_GUID);
      expect(data.isTemplate).toBe(true);
    });

    test('forwards a structure-only save without workorders', async () => {
      const minimal = { projectGuid: PROJECT_GUID, name: 'Structure only' };
      const response = await call(
        'UteamupProjectSaveAsTemplate',
        minimal,
        successReply({ ...template, name: 'Structure only' }),
        minimal,
      );

      expect(parse(response).name).toBe('Structure only');
    });

    test('surfaces the workorder template permission refusal', async () => {
      const response = await call(
        'UteamupProjectSaveAsTemplate',
        args,
        errorReply(-32603, 'Keeping workorders in a template requires the WorkorderTemplate.Create permission.'),
      );

      expect(response.body.error.message).toContain('WorkorderTemplate.Create');
    });
  });

  // ---------------------------------------------------------------------------
  // UteamupProjectTemplateAddWorkorderTemplates
  // ---------------------------------------------------------------------------
  describe('UteamupProjectTemplateAddWorkorderTemplates tool', () => {
    const args = {
      projectGuid: TEMPLATE_GUID,
      model: {
        items: [
          { workorderTemplateGuid: WORKORDER_TEMPLATE_GUID, projectStartOffsetDays: 14, projectStageOrder: 2 },
          { workorderTemplateGuid: SECOND_WORKORDER_TEMPLATE_GUID, projectStartOffsetDays: null, projectStageOrder: null },
        ],
      },
    };

    test('forwards offsets and stage orders verbatim and returns the copies', async () => {
      const copies = [
        { guid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Borescope inspection' },
        { guid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Blade wash' },
      ];
      const response = await call('UteamupProjectTemplateAddWorkorderTemplates', args, successReply(copies), args);

      const data = parse(response);
      expect(data).toHaveLength(2);
      expect(data[0].guid).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
      expect(data[0]).not.toHaveProperty('id');
    });

    test('surfaces the refusal when the target is not a project template', async () => {
      const response = await call(
        'UteamupProjectTemplateAddWorkorderTemplates',
        { ...args, projectGuid: PROJECT_GUID },
        errorReply(-32603, 'Workorder templates can only be added to a project template.'),
      );

      expect(response.body.error.message).toContain('project template');
    });

    test('surfaces the missing workorder template permission', async () => {
      const response = await call(
        'UteamupProjectTemplateAddWorkorderTemplates',
        args,
        errorReply(-32603, 'Permission denied: WorkorderTemplate.Create required'),
      );

      expect(response.body.error.message).toContain('WorkorderTemplate.Create');
    });
  });

  // ---------------------------------------------------------------------------
  // Reusable error suites (JSON-RPC compliance, 401, 503)
  // ---------------------------------------------------------------------------
  const tools = [
    { name: 'UteamupProjectTemplateList', args: {} },
    {
      name: 'UteamupProjectCreateFromTemplate',
      args: {
        templateGuid: TEMPLATE_GUID,
        name: 'Turbine overhaul 2027',
        startDateUtc: '2027-03-01T00:00:00Z',
        ownerGuid: OWNER_GUID,
      },
    },
    { name: 'UteamupProjectSaveAsTemplate', args: { projectGuid: PROJECT_GUID, name: 'Turbine overhaul template' } },
    {
      name: 'UteamupProjectTemplateAddWorkorderTemplates',
      args: { projectGuid: TEMPLATE_GUID, model: { items: [{ workorderTemplateGuid: WORKORDER_TEMPLATE_GUID }] } },
    },
  ];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
