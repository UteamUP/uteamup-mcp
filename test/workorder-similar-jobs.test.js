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

describe('workorder similar jobs MCP tool', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'test_access_token_workorder_similar_jobs';
  const workorderGuid = '11111111-1111-4111-8111-111111111111';
  const similar = {
    workorderGuid,
    items: [
      {
        guid: '22222222-2222-4222-8222-222222222222',
        ticketId: 'WO-12',
        name: 'Pump leaking seal',
        completedAt: '2026-10-01T10:00:00Z',
        score: 82,
        whatFixedIt: 'Replaced the shaft seal and flushed the line.',
        partsUsed: ['Shaft seal', 'O-ring'],
      },
    ],
  };

  const tools = [{ name: 'UteamupWorkorderSimilarJobs', args: { workorderGuid, take: 5 } }];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  async function call(toolName, args, data) {
    const response = await callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, args, successReply(data));
    expect(response.status).toBe(200);
    return JSON.parse(response.body.result.content[0].text);
  }

  it('returns ranked similar jobs with what fixed them and parts used', async () => {
    const result = await call(tools[0].name, tools[0].args, similar);

    expect(result).toEqual(similar);
    expect(result.items[0].score).toBeGreaterThanOrEqual(0);
    expect(result.items[0].score).toBeLessThanOrEqual(100);
    expect(result.items[0].partsUsed.length).toBeLessThanOrEqual(3);
  });

  it('preserves an empty history', async () => {
    const empty = { workorderGuid, items: [] };

    expect(await call(tools[0].name, tools[0].args, empty)).toEqual(empty);
  });

  it('forwards GUID-only arguments', () => {
    expect(JSON.stringify(tools[0].args)).not.toMatch(/"(?:tenantId|tenantGuid|userId|workorderId)"/);
  });

  it('round-trips a not-found for a workorder the caller cannot open', async () => {
    const response = await callMcpTool(
      BASE_URL, ACCESS_TOKEN, tools[0].name, tools[0].args,
      errorReply(-32602, `Workorder ${workorderGuid} was not found.`),
    );

    expect(response.body.error.message).toContain('not found');
  });

  it('round-trips a permission denial from the backend', async () => {
    const response = await callMcpTool(
      BASE_URL, ACCESS_TOKEN, tools[0].name, tools[0].args,
      errorReply(-32603, 'Permission denied: WorkOrder.View required.'),
    );

    expect(response.body.error.message).toContain('WorkOrder.View');
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
