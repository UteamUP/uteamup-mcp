'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Personal labour worker tools', () => {
  const base = 'https://api.test.com';
  const dispatchGuid = '11111111-1111-4111-8111-111111111111';
  const agreementGuid = '22222222-2222-4222-8222-222222222222';
  const idempotencyKey = '33333333-3333-4333-8333-333333333333';
  const call = (name, args, reply) => callMcpTool(base, 'test-worker-token', name, args, reply, args);
  const tools = [
    { name: 'UteamupLabourDispatchAccept', args: { dispatchGuid, accept: false, reason: 'Reviewed personal decline' }, result: { guid: agreementGuid } },
    { name: 'UteamupLabourTimesheetCreateMine', args: { agreementGuid, model: {
      idempotencyKey, periodStart: '2026-11-01T00:00:00Z', periodEnd: '2026-11-02T00:00:00Z',
      entries: [{ dispatchGuid, timeType: 'regular', startedAt: '2026-11-01T08:00:00Z', endedAt: '2026-11-01T09:00:00Z', notes: 'Own time' }]
    } }, result: { guid: idempotencyKey, labourAgreementGuid: agreementGuid, status: 'submitted' } },
    { name: 'UteamupLabourTimesheetsMine', args: { agreementGuid }, result: [] }
  ];
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());
  for (const tool of tools) {
    test(tool.name + ' forwards exact GUIDs and personal request with no actor selector', async () => {
      const reply = await call(tool.name, tool.args, successReply(tool.result));
      expect(JSON.parse(reply.body.result.content[0].text)).toEqual(tool.result);
      for (const key of ['tenantGuid', 'tenantId', 'userId', 'workerGuid', 'executionActorGuid', 'providerPartyGuid']) {
        expect(tool.args).not.toHaveProperty(key);
      }
    });
    test(tool.name + ' preserves authenticated-worker and permission denials', async () => {
      const reply = await call(tool.name, tool.args, errorReply(-32001, 'Authenticated worker identity required'));
      expect(reply.body.error.code).toBe(-32001);
    });
  }
  test('personal create retries keep the original model key and body', async () => {
    const tool = tools[1];
    for (let attempt = 0; attempt < 2; attempt++) {
      const reply = await call(tool.name, tool.args, successReply(tool.result));
      expect(JSON.parse(reply.body.result.content[0].text).guid).toBe(idempotencyKey);
    }
  });
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(base, tools);
  describe503ServiceUnavailable(base, tools);
});
