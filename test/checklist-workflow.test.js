'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('checklist workflow and required-list policy MCP contract', () => {
  const baseUrl = 'https://api.test.com';
  const token = 'checklist-workflow-test-token';
  const externalGuid = '11111111-1111-4111-8111-111111111111';
  const sourceGuid = '22222222-2222-4222-8222-222222222222';
  const branchGuid = '33333333-3333-4333-8333-333333333333';
  const model = {
    name: 'Pressure inspection',
    workorderMaintenanceTypes: [10, 12],
    items: [
      { externalGuid: sourceGuid, content: 'Pressure', order: 1, itemType: 'Measurement' },
      {
        externalGuid: branchGuid,
        content: 'Inspect seal',
        order: 2,
        itemType: 'Checkbox',
        condition: { dependsOnItemGuid: sourceGuid, operator: 'GreaterThan', value: '10', branch: 'Then' },
      },
    ],
  };
  const tools = [
    { name: 'UteamupChecklistCreate', args: { model } },
    { name: 'UteamupChecklistUpdate', args: { externalGuid, model } },
    { name: 'UteamupTasklistCreate', args: { model: { name: 'Isolation', workorderMaintenanceTypes: [41], tasks: [] } } },
    { name: 'UteamupTasklistUpdate', args: { externalGuid, model: { name: 'Isolation', workorderMaintenanceTypes: [] } } },
  ];
  const call = (name, args, reply) => callMcpTool(baseUrl, token, name, args, reply, args);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  it.each(tools)('$name preserves stable step identities, nested conditions and policy values', async ({ name, args }) => {
    const response = await call(name, args, successReply({ externalGuid, ...args.model }));

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual({ externalGuid, ...args.model });
    expect(nock.isDone()).toBe(true);
    expect(JSON.stringify(args)).not.toMatch(/"(?:checkListId|taskListId|tenantId|userId)"/);
  });

  it('preserves the backend rejection of an invalid forward dependency', async () => {
    const response = await call(
      'UteamupChecklistUpdate',
      { externalGuid, model },
      errorReply(-32602, 'A checklist condition must reference an earlier item in the same checklist.'),
    );
    expect(response.body.error.message).toContain('earlier item');
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
