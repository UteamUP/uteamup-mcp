'use strict';

const nock = require('nock');
const { callMcpTool: request, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const { describeJsonRpcCompliance, describe401Unauthorized, describe503ServiceUnavailable } = require('./helpers/mcp-error-tests');

describe('Reviewed ICE assignment MCP contracts', () => {
  const base = 'https://api.test.com';
  const contactGuid = '11111111-2222-4333-8444-555555555555';
  const operationGuid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const model = { userGuids: [], idempotencyKey: operationGuid,
    expectedAssignmentsHash: 'a'.repeat(64), mutationOutcomeVersion: 1 };
  const reviewed = { schemaVersion: 1, contactGuid, baselineHash: 'a'.repeat(64), assignments: [] };
  const outcome = { schemaVersion: 1, operationGuid,
    tenantGuid: '99999999-8888-4777-8666-555555555555', contactGuid,
    originalInputHash: 'b'.repeat(64), outcome: 'applied', assignmentsHash: 'c'.repeat(64),
    committedAtUtc: '2026-10-09T12:00:00.1234567Z' };
  const read = 'UteamupEmergencycontactAssignmentsReview';
  const write = 'UteamupEmergencycontactAssignmentsReplaceReviewed';
  const call = (name, args, reply, expected) => request(base, 'fixture-token', name, args, reply, expected);
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('forwards public Contact scope and coherent empty reviewed baseline', async () => {
    const args = { contactGuid };
    const reply = await call(read, args, successReply(reviewed), args);
    expect(JSON.parse(reply.body.result.content[0].text)).toEqual(reviewed);
    expect(args).not.toHaveProperty('tenantGuid');
    expect(args).not.toHaveProperty('userId');
  });
  test('forwards complete original clear operation and explicit confirmation', async () => {
    const args = { contactGuid, model, confirmed: true };
    const reply = await call(write, args, successReply(outcome), args);
    const result = JSON.parse(reply.body.result.content[0].text);
    expect(result).toEqual(outcome);
    expect(result).not.toHaveProperty('assignments');
    expect(result).not.toHaveProperty('userGuids');
  });
  test('preserves permission denial without inventing an empty successful review', async () => {
    const reply = await call(read, { contactGuid }, errorReply(403, 'Current ICE Manage authority is required.'));
    expect(reply.body.error.message).toContain('Manage');
  });
  test('preserves conflict and original key without rebasing the body', async () => {
    const args = { contactGuid, model, confirmed: true };
    const reply = await call(write, args, errorReply(409, 'Reconcile this original operation before retrying.'), args);
    expect(reply.body.error.message).toContain('original');
    expect(args.model.idempotencyKey).toBe(operationGuid);
    expect(args.model.expectedAssignmentsHash).toBe('a'.repeat(64));
  });
  test('missing confirmation remains a denied backend operation', async () => {
    const args = { contactGuid, model, confirmed: false };
    const reply = await call(write, args, errorReply(400, 'Explicit confirmation is required.'), args);
    expect(reply.body.error.message).toContain('confirmation');
  });
  const tools = [{ name: read, args: { contactGuid } },
    { name: write, args: { contactGuid, model, confirmed: true } }];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(base, tools);
  describe503ServiceUnavailable(base, tools);
});
