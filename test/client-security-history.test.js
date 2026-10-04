'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

// Raw nock-mocked HTTPS contract sources, not execution of index.js, backend
// dispatch, authorization, cursor validation, or effective-policy activation.
describe('Tenant client-security history transport contract', () => {
  const baseUrl = 'https://api.test.com';
  const token = 'client_history_contract_token';
  const name = 'UteamupTenantClientSecurityPolicyHistory';
  const tenantGuid = '33333333-3333-4333-8333-333333333333';
  const timestamp = '2026-10-04T01:02:03.1234567Z';
  const before = {
    tenantGuid,
    policyVersion: 1,
    updatedAt: null,
    offlineEnabled: true,
    maxOfflineDays: 60,
    localPassphraseAllowed: true,
    osAuthenticationAllowed: true,
    lockOnOsLock: true,
    lockOnSleep: true,
    lockOnSessionChange: true,
    lockOnShutdown: true,
    idleLockMinutes: 15,
    allowPwaLifecycleFallback: true,
    alwaysLockOnStartup: true,
  };
  const page = {
    tenantGuid,
    items: [{
      guid: '11111111-1111-4111-8111-111111111111',
      occurredAtUtc: timestamp,
      actorName: null,
      before,
      after: { ...before, policyVersion: 2, updatedAt: timestamp },
    }],
    nextCursor: null,
    skippedCount: 0,
  };
  const tools = [{ name, args: { cursor: null, pageSize: 25 } }];
  const call = (toolName, args, reply) =>
    callMcpTool(baseUrl, token, toolName, args, reply, args);

  beforeEach(() => nock.cleanAll());
  afterEach(() => {
    expect(nock.isDone()).toBe(true);
    nock.cleanAll();
  });

  test.each([
    {},
    { cursor: null, pageSize: 25 },
    { cursor: 'opaque+/=?&% #🚢', pageSize: 100 },
  ])('preserves exact scoped arguments and complete nullable history: %j', async args => {
    const response = await call(name, args, successReply(page));
    expect(response.status).toBe(200);
    const actual = JSON.parse(response.body.result.content[0].text);
    expect(actual).toEqual(page);
    expect(Object.keys(actual)).toHaveLength(4);
    expect(Object.keys(actual.items[0])).toHaveLength(5);
    expect(Object.keys(actual.items[0].before)).toHaveLength(14);
    expect(actual.items[0].actorName).toBeNull();
    expect(actual.items[0].before.updatedAt).toBeNull();
    expect(actual.items[0].after.updatedAt).toBe(timestamp);
    expect(actual.nextCursor).toBeNull();
    for (const identity of ['tenantGuid', 'tenantId', 'actorGuid', 'actorId', 'userId']) {
      expect(args).not.toHaveProperty(identity);
    }
  });

  test.each([
    { tenantGuid, items: [], nextCursor: 'opaque-next', skippedCount: 3 },
    { tenantGuid, items: [], nextCursor: null, skippedCount: 0 },
  ])('preserves empty continued and terminal pages: %j', async expected => {
    const response = await call(name, { pageSize: 3 }, successReply(expected));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(expected);
  });

  test('preserves server denial without returning history or synthesizing an empty page', async () => {
    const message = 'Tenant.Update and current membership are required.';
    const denied = await call(name, {}, errorReply(-32000, message));
    expect(denied.body.error).toEqual({ code: -32000, message });
    expect(denied.body.result).toBeUndefined();
    const httpDenied = await call(name, {}, { status: 403, body: { message } });
    expect(httpDenied.status).toBe(403);
    expect(httpDenied.body).toEqual({ message });
    expect(httpDenied.body.result).toBeUndefined();
  });

  test('leaves cursor and page limits to the server and preserves validation errors', async () => {
    const args = { cursor: 'a'.repeat(1025), pageSize: 101 };
    const message = 'Invalid client policy history query.';
    const response = await call(name, args, errorReply(-32602, message));
    expect(response.body.error).toEqual({ code: -32602, message });
    expect(response.body.result).toBeUndefined();
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
