'use strict';

const nock = require('nock');
const { callMcpTool, successReply, errorReply } = require('./helpers/mcp-test-helpers');

describe('field-service mutation safety MCP contracts', () => {
  const baseUrl = 'https://api.test.com';
  const accessToken = 'field-service-token';
  const idempotencyKey = '22222222-2222-4222-8222-222222222222';
  const expectedUpdatedAt = '2026-07-19T20:00:00Z';
  const timeEntryGuid = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, args, reply) =>
    callMcpTool(baseUrl, accessToken, toolName, args, reply, args);

  test.each([
    [
      'UteamupTimeEntryStartTimer',
      {
        idempotencyKey,
        description: 'Inspect compressor',
        workorderGuid: '44444444-4444-4444-8444-444444444444',
      },
    ],
    [
      'UteamupTimeEntryLogTime',
      {
        idempotencyKey,
        description: 'Inspect compressor',
        startTime: '2026-07-19T08:00:00Z',
        endTime: '2026-07-19T09:00:00Z',
      },
    ],
    [
      'UteamupTimeEntryStopTimer',
      { timeEntryGuid, idempotencyKey, expectedUpdatedAt },
    ],
    [
      'UteamupStockRemove',
      {
        stockGuid: '55555555-5555-4555-8555-555555555555',
        stockItemGuid: '66666666-6666-4666-8666-666666666666',
        quantity: 2,
        reason: 'Issued to field work',
        idempotencyKey,
        expectedUpdatedAt,
      },
    ],
  ])('forwards complete retry-safe arguments for %s', async (toolName, args) => {
    const response = await call(
      toolName,
      args,
      successReply({ externalGuid: timeEntryGuid }),
    );

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.result.content[0].text).externalGuid)
      .toBe(timeEntryGuid);
  });

  test('preserves changed-payload idempotency conflicts', async () => {
    const args = {
      timeEntryGuid,
      idempotencyKey,
      expectedUpdatedAt,
    };
    const response = await call(
      'UteamupTimeEntryStopTimer',
      args,
      errorReply(
        -32009,
        'The idempotency key was already used with a different request.',
      ),
    );

    expect(response.body.error.message).toMatch(/different request/i);
  });
});
