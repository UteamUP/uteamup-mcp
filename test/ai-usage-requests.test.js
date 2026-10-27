'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
} = require('./helpers/mcp-error-tests');

describe('Tenant AI usage request history', () => {
  const baseUrl = 'https://api.uteamup.com';
  const toolName = 'UteamupAIUsageRequests';
  const args = {
    from: '2026-10-01T00:00:00Z',
    to: '2026-10-27T00:00:00Z',
    page: 2,
    pageSize: 25,
    taskKey: 'industry-code.extract',
    operationKey: 'industry-code.extract',
    credentialSource: 2,
    userGuid: '11111111-1111-1111-1111-111111111111'
  };
  const call = (name, toolArgs, reply) =>
    callMcpTool(baseUrl, 'test-token', name, toolArgs, reply, toolArgs);
  const envelope = {
    fromUtc: args.from, toUtc: args.to, page: 2, pageSize: 25, totalCount: 26, items: []
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('round-trips filters and preserves net charges and unknown provider cost', async () => {
    const row = {
      requestGuid: '22222222-2222-2222-2222-222222222222',
      tenantGuid: '33333333-3333-3333-3333-333333333333',
      userGuid: args.userGuid,
      createdAt: '2026-10-02T00:00:00Z',
      credentialSource: 2,
      creditsCharged: 2,
      creditsRefunded: 3,
      costActualUsdMicros: null
    };
    const response = await call(toolName, args, successReply({ ...envelope, items: [row] }));

    expect(JSON.parse(response.body.result.content[0].text)).toEqual({ ...envelope, items: [row] });
    expect(nock.isDone()).toBe(true);
  });

  test('preserves an empty page and total count', async () => {
    const response = await call(toolName, args, successReply(envelope));
    expect(JSON.parse(response.body.result.content[0].text)).toEqual(envelope);
  });

  test('passes through permission denial without retry or changing scope', async () => {
    const response = await call(toolName, args,
      errorReply(-32603, 'Permission denied: AIUsage.ViewTenant required'));
    expect(response.body.error.message).toContain('AIUsage.ViewTenant');
    expect(args).not.toHaveProperty('tenantGuid');
    expect(args).not.toHaveProperty('tenantId');
    expect(args).not.toHaveProperty('userId');
  });

  const tools = [{ name: toolName, args }];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
