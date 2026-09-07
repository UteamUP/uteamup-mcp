'use strict';

const nock = require('nock');
const { TEST_BASE_URL, callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

// Wire contracts for the backend tools. Repository ownership and authorization
// are exercised by WorkforceSelfServiceMcpTests in the backend test project.
describe('Workforce self-service MCP contracts', () => {
  const assignmentGuid = '11111111-1111-4111-8111-111111111111';
  const shiftInstanceGuid = '22222222-2222-4222-8222-222222222222';
  const workforceGroupGuid = '33333333-3333-4333-8333-333333333333';
  const requestGuid = '44444444-4444-4444-8444-444444444444';
  const assignment = { externalGuid: assignmentGuid, shiftInstanceGuid, status: 'Confirmed' };
  const request = { externalGuid: requestGuid, status: 'Pending', concurrencyToken: 'reviewed-version' };
  const tools = [
    { name: 'UteamupShiftUserAssignmentMine', args: { dateFrom: '2026-10-01', dateTo: '2026-10-31' }, result: [assignment], empty: [] },
    { name: 'UteamupShiftUserAssignmentConfirmMine', args: { assignmentGuid }, result: assignment },
    { name: 'UteamupShiftUserAssignmentDeclineMine', args: { assignmentGuid, reason: 'Unavailable' }, result: { ...assignment, status: 'Declined' } },
    { name: 'UteamupShiftUserAssignmentSelfAssign', args: { model: { shiftInstanceGuid, workforceGroupGuid } }, result: assignment },
    { name: 'UteamupShiftRequestMine', args: {}, result: [request], empty: [] },
    { name: 'UteamupShiftRequestIncoming', args: {}, result: [request], empty: [] },
    { name: 'UteamupShiftRequestRespondCounterpart', args: { requestGuid, model: { accept: true } }, result: request },
    { name: 'UteamupShiftRequestWithdrawMine', args: { requestGuid, concurrencyToken: 'reviewed-version' }, result: true, empty: false }
  ];
  const call = (name, args, reply) => callMcpTool(TEST_BASE_URL, 'worker-access-token', name, args, reply, args);

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test.each(tools)('$name preserves its exact arguments and result', async ({ name, args, result }) => {
    const response = await call(name, args, successReply(result));

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(result);
    expect(response.body.error).toBeUndefined();
    expect(nock.isDone()).toBe(true);
  });

  test.each(tools.filter(tool => tool.empty !== undefined))('$name preserves an empty result', async ({ name, args, empty }) => {
    const response = await call(name, args, successReply(empty));

    expect(JSON.parse(response.body.result.content[0].text)).toEqual(empty);
  });

  test.each(tools)('$name preserves ownership or permission errors', async ({ name, args }) => {
    const response = await call(name, args, errorReply(-32000, 'Operation unavailable for this worker.'));

    expect(response.body.result).toBeUndefined();
    expect(response.body.error).toEqual({ code: -32000, message: 'Operation unavailable for this worker.' });
  });

  test('declining a counterpart proposal preserves accept false', async () => {
    const args = { requestGuid, model: { accept: false } };
    const response = await call('UteamupShiftRequestRespondCounterpart', args, successReply(request));

    expect(response.body.error).toBeUndefined();
    expect(nock.isDone()).toBe(true);
  });

  test('withdrawal preserves the reviewed concurrency token', async () => {
    const args = { requestGuid, concurrencyToken: 'version+/=' };
    const response = await call('UteamupShiftRequestWithdrawMine', args, errorReply(-32000, 'The request changed. Refresh before withdrawing.'));

    expect(response.body.error.message).toContain('Refresh');
    expect(nock.isDone()).toBe(true);
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(TEST_BASE_URL, tools);
  describe503ServiceUnavailable(TEST_BASE_URL, tools);
});
