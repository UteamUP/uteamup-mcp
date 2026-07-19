'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('return case lifecycle MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'return-case-token';
  const returnCaseGuid = '11111111-1111-4111-8111-111111111111';
  const idempotencyKey = '22222222-2222-4222-8222-222222222222';
  const expectedUpdatedAt = '2026-07-19T20:00:00Z';
  const transitionModel = { idempotencyKey, expectedUpdatedAt };
  const call = (toolName, toolArgs, reply) =>
    callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, reply);

  const tools = [
    {
      name: 'UteamupReturnCaseList',
      args: {
        page: 2,
        pageSize: 25,
        status: 3,
        direction: 0,
        search: 'TRACK-42',
      },
    },
    {
      name: 'UteamupReturnCaseGet',
      args: { returnCaseGuid },
    },
    {
      name: 'UteamupReturnCaseCreate',
      args: {
        model: {
          idempotencyKey,
          direction: 0,
          reason: 'Damaged in transit',
          lines: [{
            stockItemGuid: '33333333-3333-4333-8333-333333333333',
            quantity: 1,
          }],
        },
      },
    },
    ...[
      'Approve',
      'Reject',
      'Cancel',
      'Ship',
      'Receive',
      'Inspect',
      'Credit',
      'Replace',
      'Repair',
      'Close',
    ].map((action) => ({
      name: `UteamupReturnCase${action}`,
      args: {
        returnCaseGuid,
        model: transitionModel,
      },
    })),
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  test('round-trips paginated GUID-only return evidence', async () => {
    const response = await call(
      tools[0].name,
      tools[0].args,
      successReply({
        items: [{
          guid: returnCaseGuid,
          status: 3,
          direction: 0,
          commercialResolution: 0,
          events: [],
          lines: [],
        }],
        totalCount: 1,
        page: 2,
        pageSize: 25,
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.page).toBe(2);
    expect(result.items[0].guid).toBe(returnCaseGuid);
    expect(result.items[0]).not.toHaveProperty('id');
    expect(result.items[0]).not.toHaveProperty('tenantId');
  });

  test('preserves empty return pages without inventing records', async () => {
    const response = await call(
      'UteamupReturnCaseList',
      { page: 1, pageSize: 50 },
      successReply({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 50,
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  test('round-trips one reviewed transition and immutable resolution links', async () => {
    const response = await call(
      'UteamupReturnCaseReplace',
      {
        returnCaseGuid,
        model: {
          ...transitionModel,
          reason: 'Approved replacement',
          evidenceDocumentGuids: [
            '44444444-4444-4444-8444-444444444444',
          ],
        },
      },
      successReply({
        guid: returnCaseGuid,
        status: 6,
        commercialResolution: 2,
        fulfillment: {
          guid: '55555555-5555-4555-8555-555555555555',
          kind: 0,
        },
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.status).toBe(6);
    expect(result.fulfillment.guid).toBe(
      '55555555-5555-4555-8555-555555555555',
    );
    expect(result).not.toHaveProperty('tenantGuid');
  });

  test('preserves backend stale-write conflicts', async () => {
    const response = await call(
      'UteamupReturnCaseShip',
      { returnCaseGuid, model: transitionModel },
      errorReply(
        -32000,
        'The return case changed since it was last read; refresh and retry.',
      ),
    );

    expect(response.body.error.message).toMatch(/refresh and retry/i);
  });

  test('never accepts spoofed tenant or actor selectors', () => {
    for (const tool of tools) {
      expect(tool.args).not.toHaveProperty('tenantGuid');
      expect(tool.args).not.toHaveProperty('tenantId');
      expect(tool.args).not.toHaveProperty('userGuid');
      expect(tool.args).not.toHaveProperty('userId');
    }
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
