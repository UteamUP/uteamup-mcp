'use strict';

const nock = require('nock');
const {
  callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Workorder completion MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_workorder_complete';
  const workorderGuid = '11111111-1111-4111-8111-111111111111';
  const args = { workorderGuid };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply, toolArgs);

  test('forwards one GUID and returns a GUID-only completion receipt', async () => {
    const receipt = {
      workorderGuid,
      ticketId: 'WO-1042',
      name: 'Replace pump seal',
      status: 'Completed',
      updatedAt: '2026-08-06T12:00:00Z',
    };

    const response = await call(
      'UteamupWorkorderComplete',
      args,
      successReply(receipt),
    );

    expect(response.status).toBe(200);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toEqual(receipt);
    expect(data).not.toHaveProperty('id');
    expect(data).not.toHaveProperty('workorderId');
  });

  test('does not forward an integer identity or caller-selected status', async () => {
    const response = await call(
      'UteamupWorkorderComplete',
      args,
      successReply({ workorderGuid, status: 'Completed' }),
    );

    expect(response.status).toBe(200);
    expect(args).toEqual({ workorderGuid });
    expect(args).not.toHaveProperty('id');
    expect(args).not.toHaveProperty('workorderId');
    expect(args).not.toHaveProperty('completedStatusId');
  });

  test('preserves backend JSON-RPC completion errors', async () => {
    const response = await call(
      'UteamupWorkorderComplete',
      args,
      errorReply(-32602, 'Completion policy blocked the workorder'),
    );

    expect(response.body.error).toMatchObject({
      code: -32602,
      message: expect.stringContaining('Completion policy blocked'),
    });
  });

  const tools = [{ name: 'UteamupWorkorderComplete', args }];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
