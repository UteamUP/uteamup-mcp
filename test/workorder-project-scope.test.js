'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');

describe('workorder project execution ownership', () => {
  const url = 'https://api.test.com';
  const token = 'test-project-scope';
  const projectGuid = '11111111-1111-4111-8111-111111111111';
  const projectStageGuid = '22222222-2222-4222-8222-222222222222';
  const projectOutputItemGuid = '33333333-3333-4333-8333-333333333333';
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('forwards the owning project, lifecycle stage and responsible deliverable', async () => {
    const args = { title: 'Assemble machine', description: 'Use the released drawings',
      startUtc: '2026-09-14T09:00:00Z', dueUtc: '2026-09-14T17:00:00Z', idempotencyKey: 'scope-create-1',
      projectGuid, projectStageGuid, projectOutputItemGuid };
    const response = await callMcpTool(url, token, 'UteamupWorkorderCreate', args,
      successReply({ projectGuid, projectStageGuid, projectOutputItemGuid, projectOutputItemName: 'Machine M-1' }), args);
    expect(JSON.parse(response.body.result.content[0].text)).toMatchObject({ projectOutputItemGuid, projectOutputItemName: 'Machine M-1' });
  });

  test('preserves an explicit cleared deliverable and a blocked release response', async () => {
    const args = { workorderGuid: projectOutputItemGuid, model: { name: 'Retained work',
      projectOutputItemGuid: '00000000-0000-0000-0000-000000000000' } };
    const response = await callMcpTool(url, token, 'UteamupWorkorderUpdate', args,
      errorReply(-32602, 'Retain executed work with its original scope'), args);
    expect(response.body.error.message).toContain('Retain executed work');
  });
});
