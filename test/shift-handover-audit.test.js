'use strict';

const nock = require('nock');
const {
  callMcpTool: _callMcpTool,
  errorReply,
  sendRawRequest,
  successReply,
} = require('./helpers/mcp-test-helpers');
const {
  describeJsonRpcCompliance,
  describe401Unauthorized,
  describe503ServiceUnavailable,
} = require('./helpers/mcp-error-tests');

describe('Shift-handover immutable audit MCP tools', () => {
  const BASE_URL = 'https://api.test.com';
  const ACCESS_TOKEN = 'shift_handover_audit_token';
  const HANDOVER_GUID = '11111111-1111-4111-8111-111111111111';
  const signatureModel = {
    purpose: 'managerApproval',
    method: 'authenticatedConfirmation',
    meaning: 'I approve this exact immutable handover evidence version.',
    deviceKeyIdentifier: 'managed-device-key',
    idempotencyKey: '77777777-7777-4777-8777-777777777777',
  };
  const tools = [
    {
      name: 'UteamupShiftHandoverGetHistory',
      args: { handoverGuid: HANDOVER_GUID },
    },
    {
      name: 'UteamupShiftHandoverCreateSignature',
      args: { handoverGuid: HANDOVER_GUID, model: signatureModel },
    },
    {
      name: 'UteamupShiftHandoverExportAudit',
      args: { handoverGuid: HANDOVER_GUID },
    },
  ];

  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.cleanAll());

  const call = (toolName, toolArgs, mockReply) =>
    _callMcpTool(BASE_URL, ACCESS_TOKEN, toolName, toolArgs, mockReply);

  test('returns verified history without exposing integer identities', async () => {
    const history = {
      handoverGuid: HANDOVER_GUID,
      isIntegrityValid: true,
      integrityIssues: [],
      latestContentHash: 'content-hash',
      contentVersions: [],
      events: [],
      signatures: [],
    };

    const response = await call(
      'UteamupShiftHandoverGetHistory',
      { handoverGuid: HANDOVER_GUID },
      successReply(history),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result).toEqual(history);
    expect(JSON.stringify(result)).not.toMatch(/tenantId|handoverId|contentVersionId|signerUserId/);
  });

  test('preserves a legitimate empty evidence history', async () => {
    const response = await call(
      'UteamupShiftHandoverGetHistory',
      { handoverGuid: HANDOVER_GUID },
      successReply({
        handoverGuid: HANDOVER_GUID,
        isIntegrityValid: true,
        integrityIssues: [],
        contentVersions: [],
        events: [],
        signatures: [],
      }),
    );

    const result = JSON.parse(response.body.result.content[0].text);
    expect(result.events).toEqual([]);
    expect(result.signatures).toEqual([]);
  });

  test('forwards signature intent, method, device key, and idempotency GUID verbatim', async () => {
    let captured = null;
    nock(BASE_URL)
      .post('/mcp', body => {
        captured = body;
        return body.params?.name === 'UteamupShiftHandoverCreateSignature';
      })
      .reply(200, JSON.stringify(successReply({ guid: 'signature-guid' }).body), {
        'Content-Type': 'application/json',
      });

    await sendRawRequest(
      BASE_URL,
      'UteamupShiftHandoverCreateSignature',
      { handoverGuid: HANDOVER_GUID, model: signatureModel },
    );

    expect(captured.params).toEqual({
      name: 'UteamupShiftHandoverCreateSignature',
      arguments: { handoverGuid: HANDOVER_GUID, model: signatureModel },
    });
    expect(JSON.stringify(captured)).not.toMatch(/handoverId|userId|tenantId/);
  });

  test('returns the portable manifest hash and complete verified history', async () => {
    const auditExport = {
      schemaVersion: 'uteamup.shift-handover-audit.v1',
      generatedAtUtc: '2026-07-12T22:00:00Z',
      handoverGuid: HANDOVER_GUID,
      history: {
        handoverGuid: HANDOVER_GUID,
        isIntegrityValid: true,
        integrityIssues: [],
        contentVersions: [],
        events: [],
        signatures: [],
      },
      manifestHash: 'manifest-hash',
    };

    const response = await call(
      'UteamupShiftHandoverExportAudit',
      { handoverGuid: HANDOVER_GUID },
      successReply(auditExport),
    );

    expect(JSON.parse(response.body.result.content[0].text)).toEqual(auditExport);
  });

  test('preserves idempotency conflicts for reused signature evidence', async () => {
    const response = await call(
      'UteamupShiftHandoverCreateSignature',
      { handoverGuid: HANDOVER_GUID, model: signatureModel },
      errorReply(-32009, 'This idempotency GUID was already used for different signature evidence.'),
    );

    expect(response.body.error.code).toBe(-32009);
    expect(response.body.error.message).toContain('idempotency GUID');
  });

  describeJsonRpcCompliance(call, tools);
  describe401Unauthorized(BASE_URL, tools);
  describe503ServiceUnavailable(BASE_URL, tools);
});
