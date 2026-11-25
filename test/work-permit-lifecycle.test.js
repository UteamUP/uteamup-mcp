'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Work permit lifecycle MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'work-permit-lifecycle-token';
  const workPermitGuid = '5b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
  const templateGuid = '22222222-2222-4222-8222-222222222222';
  const locationGuid = '33333333-3333-4333-8333-333333333333';
  const call = (toolName, toolArgs, reply, expectedArgs) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply, expectedArgs);
  const draft = { guid: workPermitGuid, title: 'Hot work on line 3', status: 'Draft' };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('lists permits with status and paging forwarded verbatim', async () => {
    const args = { status: 'Submitted', page: 2, pageSize: 10 };
    const page = { items: [draft], totalItems: 11, page: 2, pageSize: 10 };
    const response = await call('UteamupWorkPermitList', args, successReply(page), args);

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.totalItems).toBe(11);
    expect(result.items[0].guid).toBe(workPermitGuid);
  });

  test('an empty register surfaces as an empty page', async () => {
    const response = await call(
      'UteamupWorkPermitList', {}, successReply({ items: [], totalItems: 0, page: 1, pageSize: 25 }),
    );

    expect(JSON.parse(response.body.result.content[0].text).items).toEqual([]);
  });

  test('gets one permit by GUID', async () => {
    const args = { workPermitGuid };
    const response = await call('UteamupWorkPermitGet', args, successReply(draft), args);

    expect(JSON.parse(response.body.result.content[0].text).status).toBe('Draft');
  });

  test('lists templates including inactive ones on request', async () => {
    const args = { includeInactive: true };
    const templates = [{ externalGuid: templateGuid, name: 'Hot work', approvalChainType: 'TwoStep', isActive: false }];
    const response = await call('UteamupWorkPermitTemplateList', args, successReply(templates), args);

    expect(JSON.parse(response.body.result.content[0].text)).toEqual(templates);
  });

  test('gets one template by GUID', async () => {
    const args = { templateGuid };
    const response = await call(
      'UteamupWorkPermitTemplateGet', args, successReply({ externalGuid: templateGuid, name: 'Hot work' }), args,
    );

    expect(JSON.parse(response.body.result.content[0].text).externalGuid).toBe(templateGuid);
  });

  test('creates a draft permit with GUID references only', async () => {
    const args = {
      title: 'Hot work on line 3',
      templateGuid,
      locationGuid,
      startDate: '2026-12-01T08:00:00Z',
      endDate: '2026-12-01T16:00:00Z',
    };
    const response = await call('UteamupWorkPermitCreate', args, successReply(draft), args);

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.status).toBe('Draft');
    expect(args).not.toHaveProperty('templateId');
    expect(args).not.toHaveProperty('locationId');
  });

  test('updates a draft permit', async () => {
    const args = { workPermitGuid, title: 'Hot work on line 4', locationGuid };
    const response = await call(
      'UteamupWorkPermitUpdate', args, successReply({ ...draft, title: 'Hot work on line 4' }), args,
    );

    expect(JSON.parse(response.body.result.content[0].text).title).toBe('Hot work on line 4');
  });

  test('submits a draft permit without a signature', async () => {
    const args = { workPermitGuid };
    const response = await call(
      'UteamupWorkPermitSubmit', args, successReply({ ...draft, status: 'Submitted' }), args,
    );

    expect(JSON.parse(response.body.result.content[0].text).status).toBe('Submitted');
    expect(args).not.toHaveProperty('signature');
  });

  test('takes no tenant or user arguments', async () => {
    const args = { title: 'Confined space entry' };
    await call('UteamupWorkPermitCreate', args, successReply(draft), args);

    expect(args).not.toHaveProperty('tenantId');
    expect(args).not.toHaveProperty('tenantGuid');
    expect(args).not.toHaveProperty('userId');
  });

  test('preserves the invalid_state error for a permit that left Draft', async () => {
    const response = await call(
      'UteamupWorkPermitSubmit',
      { workPermitGuid },
      errorReply(-32603, 'invalid_state: Cannot submit a permit with status Active. Only Draft permits can be submitted.'),
    );

    expect(response.body.error.code).toBe(-32603);
    expect(response.body.error.message).toContain('Only Draft permits');
  });

  test('preserves the not_found error for a permit outside the tenant', async () => {
    const response = await call(
      'UteamupWorkPermitGet',
      { workPermitGuid },
      errorReply(-32603, 'not_found: The work permit was not found in the current tenant.'),
    );

    expect(response.body.error.message).toContain('not_found');
  });

  const tools = [
    { name: 'UteamupWorkPermitList', args: {} },
    { name: 'UteamupWorkPermitGet', args: { workPermitGuid } },
    { name: 'UteamupWorkPermitTemplateList', args: {} },
    { name: 'UteamupWorkPermitTemplateGet', args: { templateGuid } },
    { name: 'UteamupWorkPermitCreate', args: { title: 'Hot work' } },
    { name: 'UteamupWorkPermitUpdate', args: { workPermitGuid, title: 'Hot work' } },
    { name: 'UteamupWorkPermitSubmit', args: { workPermitGuid } },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
