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

  test('forwards report arguments and idempotencyKey unchanged and returns reportGuid', async () => {
    const reportArgs = {
      workorderGuid,
      description: 'Replaced the pump seal and tested for leaks',
      closeOutNotes: 'Seal kit taken from van stock',
      reportDate: '2026-09-23T14:30:00Z',
      timeSpent: 1.5,
      costIncurred: 240.5,
      additionalWorkerGuids: [
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
      ],
      idempotencyKey: '44444444-4444-4444-8444-444444444444',
    };
    // A separate literal, so a proxy that mutated the caller's arguments would not match.
    const expectedArgs = JSON.parse(JSON.stringify(reportArgs));
    const reportGuid = '55555555-5555-4555-8555-555555555555';
    const receipt = {
      workorderGuid,
      ticketId: 'WO-1042',
      name: 'Replace pump seal',
      status: 'Completed',
      updatedAt: '2026-09-23T14:31:00Z',
      reportGuid,
    };

    const response = await callMcpTool(
      BASE_URL,
      ACCESS_TOKEN,
      'UteamupWorkorderComplete',
      reportArgs,
      successReply(receipt),
      expectedArgs,
    );

    expect(nock.isDone()).toBe(true);
    expect(response.status).toBe(200);
    expect(reportArgs).toEqual(expectedArgs);
    // OQ-10: the MCP tool takes no external-worker, email or notify arguments.
    expect(reportArgs).not.toHaveProperty('externalWorkerEmails');
    expect(reportArgs).not.toHaveProperty('notifyExternalWorkers');
    expect(reportArgs).not.toHaveProperty('primaryReporterId');
    expect(reportArgs).not.toHaveProperty('additionalWorkerIds');
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toEqual(receipt);
    expect(data.reportGuid).toBe(reportGuid);
    expect(data).not.toHaveProperty('reportId');
  });

  test('surfaces a 422 completion-blocked error envelope', async () => {
    // The backend throws McpException for a completion-policy refusal (the REST route answers 422).
    // ModelContextProtocol 2.2.0 returns it as an isError tool result: the SDK prefix, then the
    // backend's "code: message" text carrying every blocking reason.
    const reasons = 'Checklist "Lockout" is incomplete. Meter reading "Run hours" is missing.';
    const toolError = {
      content: [
        {
          type: 'text',
          text: `An error occurred invoking 'uteamup_workorder_complete': `
            + `workorder_completion_blocked: Cannot complete workorder: ${reasons}`,
        },
      ],
      isError: true,
    };

    const response = await call(
      'UteamupWorkorderComplete',
      { workorderGuid, description: 'Tried to close out' },
      { status: 200, body: { jsonrpc: '2.0', result: toolError, id: 1 } },
    );

    expect(response.status).toBe(200);
    expect(response.body.error).toBeUndefined();
    expect(response.body.result).toEqual(toolError);
    const { text } = response.body.result.content[0];
    expect(text).toContain('workorder_completion_blocked: ');
    expect(text).toContain(reasons);
  });

  const failureArgs = {
    workorderGuid,
    description: 'Replaced the failed pump seal',
    failure: {
      assetGuids: ['66666666-6666-4666-8666-666666666666'],
      failureCodeGuid: '77777777-7777-4777-8777-777777777777',
      failureDescription: 'Seal leaking at the shaft',
      symptoms: 'Water on the floor',
      rootCause: 'Worn seal face',
      resolution: 'Seal replaced',
      downtimeMinutes: 90,
      failureStartedAt: '2026-09-23T08:00:00Z',
      severity: 'High',
      isRepeatFailure: false,
    },
  };

  test('forwards failure object verbatim', async () => {
    const expectedArgs = JSON.parse(JSON.stringify(failureArgs));
    const createdFailureGuid = '88888888-8888-4888-8888-888888888888';
    const receipt = {
      workorderGuid,
      status: 'Completed',
      reportGuid: '55555555-5555-4555-8555-555555555555',
      createdFailureGuids: [createdFailureGuid],
    };

    const response = await callMcpTool(
      BASE_URL,
      ACCESS_TOKEN,
      'UteamupWorkorderComplete',
      failureArgs,
      successReply(receipt),
      expectedArgs,
    );

    expect(nock.isDone()).toBe(true);
    expect(failureArgs).toEqual(expectedArgs);
    expect(failureArgs.failure).not.toHaveProperty('assetIds');
    expect(failureArgs.failure).not.toHaveProperty('failureCodeId');
    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.createdFailureGuids).toEqual([createdFailureGuid]);
  });

  test('400 FailureAssetNotLinked round-trips as JSON-RPC error', async () => {
    // The REST route answers 400; the MCP handler throws an McpException carrying the same code,
    // which the SDK returns as an isError tool result. Nothing is completed.
    const toolError = {
      content: [
        {
          type: 'text',
          text: `An error occurred invoking 'uteamup_workorder_complete': `
            + 'FailureAssetNotLinked: Every failed asset must be linked to the workorder.',
        },
      ],
      isError: true,
    };

    const response = await call(
      'UteamupWorkorderComplete',
      failureArgs,
      { status: 200, body: { jsonrpc: '2.0', result: toolError, id: 1 } },
    );

    expect(nock.isDone()).toBe(true);
    expect(response.status).toBe(200);
    expect(response.body.result).toEqual(toolError);
    expect(response.body.result.content[0].text).toContain('FailureAssetNotLinked: ');
  });

  const tools = [{ name: 'UteamupWorkorderComplete', args }];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
