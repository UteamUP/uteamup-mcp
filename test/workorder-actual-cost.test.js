'use strict';

// UTE-416: uteamup_workorder_update accepted model.actualCost, returned
// isError=false and silently dropped the value. The backend now rejects any
// non-null actualCost on create/update (WorkorderBaseModel.EnsureActualCostIsNotSupplied,
// translated to "invalid_argument: …" by McpErrorTranslationBehavior). Actual
// cost is recorded through costIncurred on a work report. This pins that the
// proxy surfaces the refusal as an error and never as a successful update.

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable
} = require('./helpers/mcp-error-tests');

describe('Workorder actualCost read-only MCP contract (UTE-416)', () => {
  const BASE_URL = 'https://api.test.com';
  const TOKEN = 'fixture-access-token';
  const UPDATE = 'uteamup_workorder_update';
  const CREATE = 'uteamup_workorder_create';
  const WORKORDER = '84000000-0000-4000-8000-000000000001';
  const REFUSAL =
    'invalid_argument: actualCost is read-only and cannot be set on a workorder. ' +
    'Record incurred costs using costIncurred on a work report.';
  const call = (name, args, reply, expected) => callMcpTool(BASE_URL, TOKEN, name, args, reply, expected);
  const toolRefusal = {
    status: 200,
    body: { jsonrpc: '2.0', result: { isError: true, content: [{ type: 'text', text: REFUSAL }] }, id: 1 }
  };

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test.each([0, 25000])('update with actualCost=%s surfaces the read-only refusal as isError', async cost => {
    const args = { workorderGuid: WORKORDER, model: { actualCost: cost } };
    const response = await call(UPDATE, args, toolRefusal, args);
    expect(nock.isDone()).toBe(true);
    expect(response.body.result.isError).toBe(true);
    expect(response.body.result.content[0].text).toContain('read-only');
    expect(response.body.result.content[0].text).toContain('costIncurred');
  });

  test('create with actualCost keeps a JSON-RPC invalid_argument error rather than success', async () => {
    const args = { model: { name: 'Pump repair', actualCost: 25000 } };
    const response = await call(CREATE, args, errorReply(-32602, REFUSAL), args);
    expect(response.body.error).toMatchObject({ code: -32602 });
    expect(response.body.error.message).toContain('costIncurred');
    expect(response.body.result).toBeUndefined();
  });

  test('update without actualCost forwards estimatedCost unchanged and returns read-only actualCost', async () => {
    const args = { workorderGuid: WORKORDER, model: { estimatedCost: 25000 } };
    const updated = { guid: WORKORDER, estimatedCost: 25000, actualCost: null };
    const response = await call(UPDATE, args, successReply(updated), args);
    const data = JSON.parse(response.body.result.content[0].text);
    expect(response.body.result.isError).toBeUndefined();
    expect(data).toEqual(updated);
  });

  const tools = [{ name: UPDATE, args: { workorderGuid: WORKORDER, model: { estimatedCost: 1 } } }];
  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
