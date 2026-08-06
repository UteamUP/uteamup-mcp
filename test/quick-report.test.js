'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  successReply,
  errorReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Quick Report MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'quick-report-access-token';
  const ASSET_GUID = '11111111-1111-1111-1111-111111111111';
  const WORKORDER_GUID = '22222222-2222-2222-2222-222222222222';
  const CREATE_IDEMPOTENCY_KEY = '33333333-3333-3333-3333-333333333333';
  const COMPLETE_IDEMPOTENCY_KEY = '44444444-4444-4444-4444-444444444444';
  const call = (toolName, toolArgs, mockReply, expectedArgs) =>
    _callMcpTool(
      BASE_URL,
      ACCESS_TOKEN,
      toolName,
      toolArgs,
      mockReply,
      expectedArgs,
    );

  const createArgs = {
    description: 'Hydraulic pump is leaking at the outlet fitting.',
    severity: 'HIGH',
    assetGuid: ASSET_GUID,
    assetCode: 'PUMP-042',
    tags: 'leak,hydraulic',
    latitude: 64.1466,
    longitude: -21.9426,
    idempotencyKey: CREATE_IDEMPOTENCY_KEY,
  };
  const completeArgs = {
    workorderGuid: WORKORDER_GUID,
    summary: 'Replaced the outlet seal and confirmed there is no further leak.',
    partial: false,
    idempotencyKey: COMPLETE_IDEMPOTENCY_KEY,
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('forwards GUID-only create arguments and its idempotency key exactly', async () => {
    const response = await call(
      'UteamupQuickreportCreate',
      createArgs,
      successReply({
        workorderGuid: WORKORDER_GUID,
        ticketId: 'WO-1042',
        status: 'NotStarted',
        description: createArgs.description,
      }),
      createArgs,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toEqual({
      workorderGuid: WORKORDER_GUID,
      ticketId: 'WO-1042',
      status: 'NotStarted',
      description: createArgs.description,
    });
    expect(createArgs).not.toHaveProperty('assetId');
    expect(createArgs).not.toHaveProperty('tenantGuid');
    expect(createArgs).not.toHaveProperty('userId');
  });

  test('forwards GUID-only completion arguments and its idempotency key exactly', async () => {
    const response = await call(
      'UteamupQuickreportComplete',
      completeArgs,
      successReply({
        workorderGuid: WORKORDER_GUID,
        ticketId: 'WO-1042',
        status: 'Completed',
        completionSummary: completeArgs.summary,
      }),
      completeArgs,
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toEqual({
      workorderGuid: WORKORDER_GUID,
      ticketId: 'WO-1042',
      status: 'Completed',
      completionSummary: completeArgs.summary,
    });
    expect(completeArgs).not.toHaveProperty('workorderId');
    expect(completeArgs).not.toHaveProperty('tenantGuid');
    expect(completeArgs).not.toHaveProperty('userId');
  });

  test.each([
    ['UteamupQuickreportCreate', createArgs],
    ['UteamupQuickreportComplete', completeArgs],
  ])('%s preserves an empty backend result as null', async (toolName, toolArgs) => {
    const response = await call(toolName, toolArgs, successReply(null), toolArgs);

    expect(JSON.parse(response.body.result.content[0].text)).toBeNull();
  });

  test.each([
    [
      'UteamupQuickreportCreate',
      createArgs,
      -32602,
      'Severity must be LOW, MEDIUM, HIGH, or CRITICAL.',
    ],
    [
      'UteamupQuickreportComplete',
      completeArgs,
      -32000,
      'Permission denied: WorkOrder.Update or WorkOrder.Update.Own required',
    ],
  ])('%s preserves backend JSON-RPC errors', async (toolName, toolArgs, code, message) => {
    const response = await call(toolName, toolArgs, errorReply(code, message), toolArgs);

    expect(response.status).toBe(200);
    expect(response.body.error).toEqual({ code, message });
    expect(response.body.result).toBeUndefined();
  });

  const tools = [
    { name: 'UteamupQuickreportCreate', args: createArgs },
    { name: 'UteamupQuickreportComplete', args: completeArgs },
  ];

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
