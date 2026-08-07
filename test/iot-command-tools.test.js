/**
 * Governed IoT-command MCP proxy contracts.
 *
 * The backend owns feature access, tenant scope, command schema validation,
 * optimistic concurrency, approvals, dispatch receipts, and outcomes. The
 * generic proxy only preserves the reviewed GUID-first arguments.
 */

'use strict';

const nock = require('nock');
const {
  callMcpTool,
  sendRawRequest,
  successReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('governed IoT command tools', () => {
  const baseUrl = 'https://api.test.com';
  const accessToken = 'test_access_token_iot_commands';
  const definitionGuid = '11111111-1111-4111-8111-111111111111';
  const deviceTypeGuid = '22222222-2222-4222-8222-222222222222';
  const deviceGuid = '33333333-3333-4333-8333-333333333333';
  const requestGuid = '44444444-4444-4444-8444-444444444444';
  const idempotencyKey = '55555555-5555-4555-8555-555555555555';
  const expectedUpdatedAt = '2026-07-20T08:00:00Z';
  const createDefinition = {
    idempotencyKey,
    deviceTypeGuid,
    commandKey: 'set.target',
    displayName: 'Set target',
    parametersSchemaJson:
      '{"type":"object","properties":{"target":{"type":"number"}},' +
      '"required":["target"],"additionalProperties":false}',
    riskClass: 'High',
    timeoutSeconds: 30,
    isReversible: true,
    requiredPermission: 'IOT.Control',
  };
  const decision = {
    idempotencyKey,
    expectedUpdatedAt,
    comment: 'Reviewed against current device evidence.',
  };
  const tools = [
    {
      name: 'UteamupIoTCommandDefinitionsList',
      args: { deviceTypeGuid },
    },
    {
      name: 'UteamupIoTCommandDefinitionHistory',
      args: { deviceTypeGuid },
    },
    {
      name: 'UteamupIoTCommandDefinitionCreate',
      args: { request: createDefinition },
    },
    {
      name: 'UteamupIoTCommandDefinitionUpdate',
      args: {
        definitionGuid,
        request: { ...createDefinition, expectedUpdatedAt },
      },
    },
    {
      name: 'UteamupIoTCommandControlGet',
      args: {},
    },
    {
      name: 'UteamupIoTCommandControlUpdate',
      args: {
        request: {
          idempotencyKey,
          commandsEnabled: false,
          reason: 'Incident containment',
          expectedUpdatedAt,
        },
      },
    },
    {
      name: 'UteamupIoTCommandRequestPreview',
      args: {
        request: {
          idempotencyKey,
          definitionGuid,
          deviceGuid,
          parameters: { target: 42 },
          expectedUpdatedAt,
        },
      },
    },
    {
      name: 'UteamupIoTCommandRequestsList',
      args: {
        page: 1,
        pageSize: 25,
        deviceGuid,
        status: 'AwaitingApproval',
        riskClass: 'High',
        commandKey: 'set.target',
      },
    },
    {
      name: 'UteamupIoTCommandRequestGet',
      args: { requestGuid },
    },
    {
      name: 'UteamupIoTCommandRequestConfirm',
      args: { requestGuid, request: decision },
    },
    {
      name: 'UteamupIoTCommandRequestApprove',
      args: { requestGuid, request: decision },
    },
    {
      name: 'UteamupIoTCommandRequestReject',
      args: { requestGuid, request: decision },
    },
    {
      name: 'UteamupIoTCommandRequestCancel',
      args: {
        requestGuid,
        request: { ...decision, reason: 'Device entered maintenance.' },
      },
    },
    {
      name: 'UteamupIoTCommandMonitoringGet',
      args: {},
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    callMcpTool(baseUrl, accessToken, toolName, toolArgs, mockReply);

  it('preserves an empty command-definition result', async () => {
    const response = await call(
      'UteamupIoTCommandDefinitionsList',
      {},
      successReply([]),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data).toEqual([]);
  });

  it('forwards an evidence-bound preview without caller-controlled scope', async () => {
    const preview = tools.find(
      tool => tool.name === 'UteamupIoTCommandRequestPreview',
    );
    let captured;
    nock(baseUrl)
      .post('/mcp', body => {
        captured = body;
        return true;
      })
      .reply(200, JSON.stringify(successReply({
        requestGuid,
        definitionGuid,
        deviceGuid,
        status: 'Previewed',
        payloadHash: 'sha256:reviewed',
      }).body), {
        'Content-Type': 'application/json',
      });

    await sendRawRequest(baseUrl, preview.name, preview.args);

    expect(captured.params.arguments).toEqual(preview.args);
    expect(captured.params.arguments.tenantGuid).toBeUndefined();
    expect(captured.params.arguments.userId).toBeUndefined();
    expect(captured.params.arguments.definitionId).toBeUndefined();
    expect(captured.params.arguments.deviceId).toBeUndefined();
  });

  it('preserves immutable approval, delivery, and outcome evidence', async () => {
    const response = await call(
      'UteamupIoTCommandRequestGet',
      { requestGuid },
      successReply({
        requestGuid,
        stableDeliveryId: '66666666-6666-4666-8666-666666666666',
        status: 'Succeeded',
        approvals: [{
          approvalGuid: '77777777-7777-4777-8777-777777777777',
          kind: 'SecondApproval',
          decision: 'Approved',
        }],
        events: [{
          eventGuid: '88888888-8888-4888-8888-888888888888',
          sequence: 4,
          eventType: 'Succeeded',
        }],
        outcomeSummary: 'Target applied',
        outcomeEvidenceJson: '{"observed":true}',
      }),
    );

    const data = JSON.parse(response.body.result.content[0].text);
    expect(data.requestGuid).toBe(requestGuid);
    expect(data.approvals).toHaveLength(1);
    expect(data.events[0].sequence).toBe(4);
    expect(data.outcomeSummary).toBe('Target applied');
    expect(data.requestId).toBeUndefined();
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(baseUrl, tools);
  describe503ServiceUnavailable(baseUrl, tools);
});
